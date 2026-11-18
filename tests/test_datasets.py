import csv
import json
import sys

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient
from scipy.signal import resample_poly

from vsr import cli
from vsr.api import compute_device
from vsr.dataset import scan as scanner
from vsr.frame import decode_frame
from vsr.server.app import create_app


@pytest.fixture
def sources(tmp_path):
    rng = np.random.default_rng(42)
    wide, narrow, additional = (tmp_path / name for name in ("48k", "16k", "additional"))
    for directory in (wide, narrow, additional):
        directory.mkdir()

    noise = rng.normal(0, 0.1, 96 * 12000).astype(np.float32)
    down = resample_poly(noise, 1, 3)
    for index, (full, low) in enumerate(zip(np.split(noise, 96), np.split(down, 96), strict=True)):
        sf.write(wide / f"{index:03}.wav", full, 48000, subtype="FLOAT")
        sf.write(narrow / f"{index:03}.wav", low, 16000, subtype="FLOAT")

    band = np.fft.rfft(rng.normal(0, 0.1, 48000))
    band[np.fft.rfftfreq(48000, 1 / 48000) > 8000] = 0
    sf.write(additional / "band.wav", np.fft.irfft(band), 48000, subtype="FLOAT")
    up = resample_poly(rng.normal(0, 0.1, 16000), 3, 1)
    sf.write(additional / "upsampled.wav", up, 48000, subtype="FLOAT")
    clipped = np.zeros(48000, dtype=np.float32)
    clipped[4800:38400] = 0.25
    clipped[5000:5480] = 1
    sf.write(additional / "clipped.wav", clipped, 48000, subtype="FLOAT")
    (additional / "corrupt.wav").write_bytes(b"not a WAV file")
    rates = (8000, 22050, 32000, 44100)
    for sr in rates:
        sf.write(additional / f"{sr}.wav", rng.normal(0, 0.1, sr // 4), sr, subtype="FLOAT")

    manifest = tmp_path / "manifest.jsonl"
    ordered = [
        "band.wav",
        "upsampled.wav",
        "clipped.wav",
        "corrupt.wav",
        *(f"{sr}.wav" for sr in rates),
    ]
    manifest.write_text(
        "".join(
            json.dumps({"path": f"additional/{name}", "source": "manifest", "speaker": index})
            + "\n"
            for index, name in enumerate(ordered)
        ),
        encoding="utf-8",
    )
    return wide, narrow, manifest


def wait_scan(client, socket, sources):
    started = client.post("/api/datasets", json={"sources": [str(source) for source in sources]})
    assert started.is_success, started.text
    identifier = started.json()["id"]
    while True:
        event = socket.receive_json()
        assert event["type"] == "job_progress" and event["id"] == identifier
        if event["status"] != "running":
            assert event["status"] == "done", event
            assert event["completed"] == event["total"] == 200
            assert event["error"] is None
            break
    rows = client.get(f"/api/datasets/{identifier}/rows")
    assert rows.is_success, rows.text
    return identifier, rows.json()


def test_dataset_metrics_group_ltas_and_http_cli_cache(sources, tmp_path, monkeypatch):
    home = tmp_path / "state"
    monkeypatch.setenv("VSR_HOME", str(home))
    metrics_calls = []
    original = scanner.file_metrics

    def counted(*args):
        assert compute_device().type == "cpu"
        metrics_calls.append(1)
        return original(*args)

    monkeypatch.setattr(scanner, "file_metrics", counted)
    headers = {"Authorization": "Bearer test"}
    with TestClient(create_app("test", "cpu"), headers=headers) as client:
        monkeypatch.setattr("vsr.api._device", "mps")
        with client.websocket_connect("/ws?token=test") as socket:
            identifier, rows = wait_scan(client, socket, sources)
            assert len(metrics_calls) == 199
            assert compute_device().type == "mps"

            result = rows["data"]
            assert len(rows["columns"]) == len(result)
            assert all(len(column) == 200 for column in result.values())
            assert result["source"] == [
                str(source)
                for source, count in zip(sources, (96, 96, 8), strict=True)
                for _ in range(count)
            ]
            assert result["meta.source"] == [None] * 192 + ["manifest"] * 8
            assert result["speaker"] == [None] * 192 + list(range(8))

            band, up, clipped, corrupt = range(192, 196)
            assert abs(result["bandwidth_hz"][band] - 8000) <= 93.75
            assert result["bandwidth_hz"][up] < 10000
            assert result["clip_ratio"][clipped] == 0.01
            assert result["lead_silence_s"][clipped] == 0.1
            assert result["trail_silence_s"][clipped] == 0.2
            assert result["error"][corrupt]
            assert result["sr"][corrupt] is None

            groups = {"48 kHz": list(range(96)), "16 kHz": list(range(96, 192))}
            response = client.post(f"/api/datasets/{identifier}/ltas", json={"groups": groups})
            assert response.is_success, response.text
            arrays, metadata = decode_frame(response.content)
            assert metadata["groups"] == list(groups)
            assert metadata["unit"] == "db_per_hz"
            freq = arrays["freqs"]
            band = (freq >= 100) & (freq <= 7000)
            means = arrays["mean"]
            assert np.isfinite(means[:, band]).all()
            np.testing.assert_array_less(np.abs(means[0, band] - means[1, band]), 0.5)
            assert np.isnan(means[1, freq > 8000]).all()

            _, repeated = wait_scan(client, socket, sources)
            assert repeated == rows
            assert len(metrics_calls) == 199

        output = tmp_path / "metrics.csv"
        vectors = tmp_path / "ltas.npz"
        monkeypatch.setattr(
            sys,
            "argv",
            [
                "vsr",
                "scan",
                *(str(source) for source in sources),
                "-o",
                str(output),
                "--ltas",
                str(vectors),
                "--group-by",
                "source",
            ],
        )
        cli.main()
        assert len(metrics_calls) == 199
        assert (home / "cache" / "datasets.sqlite").is_file()

    with output.open(newline="", encoding="utf-8") as document:
        records = list(csv.reader(document))
    assert records[0] == rows["columns"]
    expected = [
        ["" if value is None else str(scanner.csv_cell(value)) for value in group]
        for group in zip(*result.values(), strict=True)
    ]
    assert records[1:] == expected
    with np.load(vectors, allow_pickle=False) as ltas:
        assert set(ltas.files) == {"groups", "freqs", "mean", "p10", "p90"}
        assert ltas["groups"].tolist() == [str(source) for source in sources]
        np.testing.assert_array_equal(ltas["freqs"], freq)
        np.testing.assert_array_equal(ltas["mean"][:2], means)
