import os
import subprocess
import sys
import textwrap
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Event, Lock

import numpy as np
import pytest
import soundfile as sf
import torch
from fastapi.testclient import TestClient
from scipy.signal import get_window

from vsr.frame import decode_frame
from vsr.server import routes_spectrogram
from vsr.server.app import create_app

HEADERS = {"Authorization": "Bearer secret"}


def reference(samples, n_fft, win, hop):
    window = torch.tensor(get_window("hann", win, fftbins=True), dtype=torch.float32)
    values = torch.stft(
        torch.tensor(samples),
        n_fft,
        hop_length=hop,
        win_length=win,
        window=window,
        center=True,
        pad_mode="constant",
        return_complex=True,
    )
    return (20 * torch.log10(torch.clamp(values.abs() * (2 / window.sum()), min=1e-10))).numpy()


def query(client, lane, **changes):
    params = dict(
        t0=0,
        t1=4,
        width=100,
        height=100,
        f_lo=0,
        f_hi=16,
        yscale="linear",
        channel=0,
        mode="stft",
        n_fft=8,
        win_length=6,
        hop=4,
        window="hann",
        window_param=0,
    )
    params.update(changes)
    response = client.get(f"/api/lanes/{lane}/spectrogram", params=params, headers=HEADERS)
    assert response.status_code == 200, response.text
    return decode_frame(response.content)


@pytest.mark.parametrize("n_fft", [8, 9])
def test_odd_and_even_centered_reference(tmp_path, monkeypatch, n_fft):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    rng = np.random.default_rng(19)
    samples = rng.normal(0, 0.2, 32).astype(np.float32)
    path = tmp_path / "input.wav"
    sf.write(path, samples, 32, subtype="FLOAT")
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        values, meta = query(client, lane, n_fft=n_fft)
        expected = reference(samples, n_fft, 6, 4).astype(np.float16)
        np.testing.assert_allclose(values, expected, atol=0.03125, rtol=0)
        assert meta["shape"] == list(expected.shape)
        assert meta["lane_db_max"] == pytest.approx(reference(samples, n_fft, 6, 4).max(), abs=2e-5)
        assert client.get(f"/api/lanes/{lane}/spectrogram").status_code == 401


def test_absolute_groups_offset_and_cache(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = np.random.default_rng(7).normal(0, 0.2, 124).astype(np.float32)
    path = tmp_path / "input.wav"
    sf.write(path, samples, 32, subtype="FLOAT")
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        client.patch(f"/api/lanes/{lane}", json={"offset": 0.5}, headers=HEADERS)
        a, meta = query(client, lane, t0=0.5 + 4.75 / 8, t1=0.5 + 17.25 / 8, width=4)
        b, _ = query(client, lane, t0=0.5 + 8.75 / 8, t1=0.5 + 21.25 / 8, width=4)
        ref = reference(samples, 8, 6, 4).astype(np.float16)
        expected = np.stack([ref[:, i : i + 4].max(axis=1) for i in (4, 8, 12, 16)], axis=1)
        np.testing.assert_array_equal(a, expected)
        np.testing.assert_array_equal(a[:, 1:], b[:, :3])
        assert meta["col_t0"] == 1.1875
        assert meta["col_dt"] == 0.5


def test_pyramids_and_scalar(tmp_path, monkeypatch):
    samples = np.random.default_rng(4).normal(0, 0.1, 4092).astype(np.float32)
    path = tmp_path / "input.wav"
    sf.write(path, samples, 32, subtype="FLOAT")
    ref = reference(samples, 8, 6, 4).astype(np.float16)
    for budget in (100000, 755):
        root = tmp_path / str(budget)
        root.mkdir()
        (root / "config.toml").write_text(f"cache_bytes = {budget}\n")
        monkeypatch.setenv("VSR_HOME", str(root))
        with TestClient(create_app("secret", "cpu", [str(path)])) as client:
            lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
            for width, p in ((128, 8), (16, 64)):
                result, meta = query(client, lane, t1=128, width=width)
                expected = np.stack(
                    [ref[:, i : i + p].max(axis=1) for i in range(0, ref.shape[1], p)], axis=1
                )
                np.testing.assert_array_equal(result, expected)
                assert meta["col_dt"] == p / 8


def observe_flight_waiters(monkeypatch, app, waiting):
    original = Future.result
    count = 0
    lock = Lock()

    def observed(self, timeout=None):
        nonlocal count
        with app.state.session.cache_lock:
            is_flight = self in app.state.session.inflight.values()
        if is_flight:
            with lock:
                count += 1
                if count == 2:
                    waiting.set()
        return original(self, timeout)

    monkeypatch.setattr(Future, "result", observed)


def test_concurrent_coalescing(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "input.wav"
    sf.write(
        path, np.random.default_rng(8).normal(0, 0.1, 124).astype(np.float32), 32, subtype="FLOAT"
    )
    entered, waiting, release = Event(), Event(), Event()

    original = routes_spectrogram.build_entry
    calls = []

    def wrapped(*args):
        calls.append(1)
        entered.set()
        assert release.wait(10)
        return original(*args)

    app = create_app("secret", "cpu", [str(path)])
    with TestClient(app) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        ready, _ = query(client, lane, hop=2)
        observe_flight_waiters(monkeypatch, app, waiting)
        monkeypatch.setattr(routes_spectrogram, "build_entry", wrapped)
        with ThreadPoolExecutor(max_workers=3) as pool:
            first = pool.submit(query, client, lane, t0=0, t1=2, width=4)
            assert entered.wait(10)
            second = pool.submit(query, client, lane, t0=1, t1=3, width=4)
            assert waiting.wait(10)
            try:
                cached = pool.submit(query, client, lane, hop=2)
                np.testing.assert_array_equal(cached.result(timeout=5)[0], ready)
            finally:
                release.set()
            a, _ = first.result(timeout=20)
            b, _ = second.result(timeout=20)
        assert len(calls) == 1
        np.testing.assert_array_equal(a[:, 1:], b[:, :2])


def test_cold_ten_minute_rss(tmp_path):
    path = tmp_path / "ten-minutes.wav"
    sr = 48000
    with sf.SoundFile(path, "w", samplerate=sr, channels=1, subtype="PCM_16") as output:
        for start in range(0, 600 * sr, sr):
            i = np.arange(start, start + sr, dtype=np.float64)
            output.write(
                0.4 * np.sin(2 * np.pi * 440 * i / sr) + 0.2 * np.sin(2 * np.pi * 3000 * i / sr)
            )
    child = textwrap.dedent(
        """
        import os, resource, sys
        import torch
        from fastapi.testclient import TestClient
        from vsr.frame import decode_frame
        from vsr.server.app import create_app
        torch.set_num_threads(2)
        headers = {"Authorization": "Bearer secret"}
        with TestClient(create_app("secret", "cpu")) as client:
            opened = client.post("/api/open", json={"paths": [sys.argv[1]]}, headers=headers)
            assert opened.status_code == 200, opened.text
            lane = opened.json()["lanes"][0]["id"]
            params = dict(t0=0, t1=600, width=1024, height=256, f_lo=0, f_hi=8000,
                          yscale="linear", channel=0, mode="stft", n_fft=1024,
                          win_length=240, hop=48, window="hann", window_param=0)
            response = client.get(f"/api/lanes/{lane}/spectrogram", params=params, headers=headers)
            assert response.status_code == 200, response.text
            array, meta = decode_frame(response.content)
            assert array.shape == (171, 586), array.shape
            assert array.dtype.name == "float16"
            assert meta["row_freqs"][0] == 0 and meta["row_freqs"][-1] == 7968.75
            assert meta["col_t0"] == 0.5115 and meta["col_dt"] == 1.024
            rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            size = rss if sys.platform == "darwin" else rss * 1024
            print("device=cpu PCM16 mono 48000Hz 600s cache=2147483648 cold "
                  f"shape={array.shape} ru_maxrss={rss} bytes={size} "
                  f"GiB={size / 2**30:.6f} threshold=1610612736", flush=True)
            assert size < 1610612736
        """
    )
    env = os.environ.copy()
    env["VSR_HOME"] = str(tmp_path / "home")
    result = subprocess.run(
        [sys.executable, "-c", child, str(path)],
        env=env,
        capture_output=True,
        text=True,
        timeout=600,
        check=False,
    )
    print(f"cold child exit={result.returncode} {result.stdout} {result.stderr}")
    assert result.returncode == 0


def test_frequency_pooling_and_log_interpolation(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = np.random.default_rng(27).normal(0, 0.1, 2048).astype(np.float32)
    path = tmp_path / "input.wav"
    sf.write(path, samples, 16000, subtype="FLOAT")
    ref = reference(samples, 512, 240, 48).astype(np.float16)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        common = dict(t0=0, t1=0.1, width=100, n_fft=512, win_length=240, hop=48)
        linear, meta = query(client, lane, f_lo=25, f_hi=160, height=2, **common)
        expected = np.stack([ref[1:4, :34].max(axis=0), ref[4:6, :34].max(axis=0)])
        np.testing.assert_array_equal(linear, expected)
        assert meta["row_freqs"] == [62.5, 140.625]
        result, meta = query(client, lane, f_lo=40, f_hi=80, yscale="log", height=2, **common)
        center = np.sqrt(40 * np.sqrt(40 * 80))
        weight = (center - 31.25) / 31.25
        row = (ref[1, :34].astype(np.float32) * (1 - weight) + ref[2, :34] * weight).astype(
            np.float16
        )
        np.testing.assert_array_equal(result[0], row)
        np.testing.assert_array_equal(result[1], ref[2, :34])
        np.testing.assert_allclose(meta["row_freqs"], [47.5682846001, 67.2717132203])


def test_cache_device_and_transform_invalidation(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = np.random.default_rng(2).normal(0, 0.1, (124, 2)).astype(np.float32)
    path = tmp_path / "input.wav"
    sf.write(path, samples, 32, subtype="FLOAT")
    original = routes_spectrogram.build_entry
    calls = []

    def wrapped(*args):
        calls.append(1)
        return original(*args)

    monkeypatch.setattr(routes_spectrogram, "build_entry", wrapped)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        query(client, lane)
        client.patch(f"/api/lanes/{lane}", json={"offset": 0.5}, headers=HEADERS)
        query(client, lane)
        assert len(calls) == 1
        query(client, lane, channel=1)
        query(client, lane, hop=2)
        assert len(calls) == 3
        assert (
            client.post(
                "/api/settings", json={"compute_device": "cpu"}, headers=HEADERS
            ).status_code
            == 200
        )
        query(client, lane)
        assert len(calls) == 4


def test_chunk_cut_pyramids_and_partial_terminal(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = np.random.default_rng(44).normal(0, 0.1, 8195 * 48).astype(np.float32)
    samples[8176 * 48 - 1 : 8176 * 48 + 2] = 0.9
    path = tmp_path / "input.wav"
    sf.write(path, samples, 48000, subtype="FLOAT")
    ref = reference(samples, 1024, 240, 48).astype(np.float16)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        common = dict(t0=0, t1=10, f_hi=24000, height=513, n_fft=1024, win_length=240, hop=48)
        for p in (8, 64):
            result, _ = query(client, lane, width=(ref.shape[1] + p - 1) // p, **common)
            expected = np.stack(
                [ref[:, i : i + p].max(axis=1) for i in range(0, ref.shape[1], p)], axis=1
            )
            np.testing.assert_array_equal(result, expected)


def test_version_change_rebuilds(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "input.wav"
    sf.write(path, np.zeros(124, dtype=np.float32), 32, subtype="FLOAT")
    app = create_app("secret", "cpu", [str(path)])
    with TestClient(app) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        _, first = query(client, lane)
        with app.state.session.lock:
            source = app.state.session.lane(lane)
            source.data = torch.ones_like(source.data)
            source.version += 1
        _, second = query(client, lane)
        assert first["lane_db_max"] < -190
        assert second["lane_db_max"] > 0


@pytest.mark.parametrize(
    "device",
    [
        "cpu",
        pytest.param(
            "cuda",
            marks=pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA unavailable"),
        ),
        pytest.param(
            "mps",
            marks=pytest.mark.skipif(
                not torch.backends.mps.is_available(), reason="MPS unavailable"
            ),
        ),
    ],
)
def test_chunk_selected_device_against_whole_lane(device):
    from vsr.dsp.stft import stft_chunk

    samples = np.random.default_rng(67).normal(0, 0.2, 32).astype(np.float32)
    expected = reference(samples, 9, 6, 4)[:, 3:6]
    actual = stft_chunk(torch.tensor(samples), 3, 6, 9, 6, 4, "hann", 0, torch.device(device))
    np.testing.assert_allclose(actual, expected, atol=0.0001, rtol=0)


def test_lru_exact_admission_and_eviction():
    from vsr.server.session import Session

    data = torch.linspace(-1, 1, 124)

    def build(device):
        return routes_spectrogram.build_entry(data, 8, 6, 4, "hann", 0, device, 800)

    session = Session()
    for key in ("a", "b", "a", "c"):
        routes_spectrogram.cached_entry(session, key, build, 800)
    assert list(session.cache) == ["a", "c"]
    assert session.cache_size == 756
    full = routes_spectrogram.build_entry(data, 8, 6, 4, "hann", 0, torch.device("cpu"), 756)
    scalar = routes_spectrogram.build_entry(data, 8, 6, 4, "hann", 0, torch.device("cpu"), 755)
    assert full[0].nbytes == 320 and full[1].nbytes == 40 and full[2].nbytes == 10
    assert scalar[:3] == (None, None, None)
    assert scalar[3] == full[3]


def test_scalar_scan_and_overlapping_views(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    (tmp_path / "config.toml").write_text("cache_bytes = 755\n")
    samples = np.random.default_rng(31).normal(0, 0.1, 124).astype(np.float32)
    samples[80:] *= 3
    path = tmp_path / "input.wav"
    sf.write(path, samples, 32, subtype="FLOAT")
    original = routes_spectrogram.stft_chunk
    ranges = []

    def observed(data, start, end, *args):
        ranges.append((start, end))
        return original(data, start, end, *args)

    monkeypatch.setattr(routes_spectrogram, "stft_chunk", observed)
    ref = reference(samples, 8, 6, 4)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        a, ma = query(client, lane, t0=4.75 / 8, t1=17.25 / 8, width=4)
        b, mb = query(client, lane, t0=8.75 / 8, t1=21.25 / 8, width=4)
        np.testing.assert_array_equal(a[:, 1:], b[:, :3])
        expected = ref.astype(np.float16)
        np.testing.assert_array_equal(
            a, np.stack([expected[:, i : i + 4].max(axis=1) for i in (4, 8, 12, 16)], axis=1)
        )
        assert ranges.count((0, 32)) == 1
        assert ranges[1:] == [
            (4, 8),
            (8, 12),
            (12, 16),
            (16, 20),
            (8, 12),
            (12, 16),
            (16, 20),
            (20, 24),
        ]
        assert ma["lane_db_max"] == mb["lane_db_max"] == pytest.approx(ref.max(), abs=2e-5)


def test_invalidation_during_inflight(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "input.wav"
    sf.write(path, np.ones(124, dtype=np.float32), 32, subtype="FLOAT")
    entered, release = Event(), Event()
    original = routes_spectrogram.build_entry
    calls = []

    def wrapped(*args):
        calls.append(1)
        if len(calls) == 1:
            entered.set()
            assert release.wait(10)
        return original(*args)

    monkeypatch.setattr(routes_spectrogram, "build_entry", wrapped)
    app = create_app("secret", "cpu", [str(path)])
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=2) as pool:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        old = pool.submit(query, client, lane)
        assert entered.wait(10)
        assert (
            client.post(
                "/api/settings", json={"compute_device": "cpu"}, headers=HEADERS
            ).status_code
            == 200
        )
        release.set()
        old.result(timeout=20)
        assert not app.state.session.cache
        query(client, lane)
        assert len(calls) == 2


def test_nonbinary_frame_edges_and_empty_view(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = np.random.default_rng(73).normal(0, 0.1, 200).astype(np.float32)
    path = tmp_path / "input.wav"
    sf.write(path, samples, 44100, subtype="FLOAT")
    ref = reference(samples, 8, 6, 7).astype(np.float16)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        client.patch(f"/api/lanes/{lane}", json={"offset": 0.3}, headers=HEADERS)
        start, end = 0.3 + 5 * 7 / 44100, 0.3 + 17 * 7 / 44100
        result, meta = query(client, lane, t0=start, t1=end, hop=7, f_hi=22050)
        np.testing.assert_array_equal(result, ref[:, 5:18])
        assert meta["cols"] == 13
        outside, meta = query(client, lane, t0=1, t1=2, hop=7, f_hi=22050)
        assert outside.shape == (5, 0)
        assert meta["view_db_max"] is None
        inner, _ = query(client, lane, t0=start + 1e-8, t1=end - 1e-8, hop=7, f_hi=22050)
        np.testing.assert_array_equal(inner, ref[:, 6:17])


@pytest.mark.parametrize(
    ("sr", "n_fft", "length", "tone_bin", "t0", "t1", "lo", "hi", "row_freqs", "bins"),
    [
        (9000, 9, 72, 4, 0.00395, 0.00405, 1700, 4400, [2156.25371248, 3468.97953459], (2, 4)),
        (16000, 160, 1280, 2, 0.0399, 0.0401, 100, 400, [141.42135624, 282.84271247], (1, 2)),
    ],
)
def test_log_band_boundaries_http(
    tmp_path, monkeypatch, sr, n_fft, length, tone_bin, t0, t1, lo, hi, row_freqs, bins
):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = (np.cos(2 * np.pi * tone_bin * np.arange(length) / n_fft) / 3).astype(np.float32)
    path = tmp_path / "tone.wav"
    sf.write(path, samples, sr, subtype="FLOAT")
    ref = reference(samples, n_fft, n_fft, n_fft).astype(np.float16)
    frame = round(((t0 + t1) / 2) * sr / n_fft)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        result, meta = query(
            client,
            lane,
            t0=t0,
            t1=t1,
            width=1,
            height=2,
            f_lo=lo,
            f_hi=hi,
            yscale="log",
            n_fft=n_fft,
            win_length=n_fft,
            hop=n_fft,
        )
    np.testing.assert_array_equal(result[:, 0], ref[list(bins), frame])
    np.testing.assert_allclose(meta["row_freqs"], row_freqs, rtol=0, atol=1e-8)
    assert meta["f_axis"] == {"scale": "log", "lo": lo, "hi": hi}


def test_empty_audio_frame_has_strict_json(tmp_path, monkeypatch):
    import json
    import struct

    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "empty.wav"
    sf.write(path, np.empty(0, dtype=np.float32), 9000, subtype="PCM_16")
    with TestClient(create_app("secret", "cpu")) as client:
        opened = client.post("/api/open", json={"paths": [str(path)]}, headers=HEADERS)
        assert opened.status_code == 200
        lane = opened.json()["lanes"][0]["id"]
        params = dict(
            t0=-1,
            t1=1,
            width=1,
            height=2,
            f_lo=0,
            f_hi=4500,
            yscale="linear",
            channel=0,
            mode="stft",
            n_fft=9,
            win_length=6,
            hop=9,
            window="hann",
            window_param=0,
        )
        response = client.get(f"/api/lanes/{lane}/spectrogram", params=params, headers=HEADERS)
        assert response.status_code == 200
        size = struct.unpack_from("<I", response.content)[0]

        def reject_constant(value):
            raise ValueError(f"Invalid JSON constant {value}")

        header = json.loads(response.content[4 : 4 + size], parse_constant=reject_constant)
        assert header["shape"] == [2, 0]
        assert header["lane_db_max"] is None
        assert header["view_db_max"] is None


def test_scalar_reducer_does_not_accumulate_chunks(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    (tmp_path / "config.toml").write_text("cache_bytes = 8\n")
    samples = np.random.default_rng(91).normal(0, 0.1, 512).astype(np.float32)
    path = tmp_path / "signal.wav"
    sf.write(path, samples, 48000, subtype="FLOAT")
    ref = reference(samples, 32768, 32, 1).astype(np.float16)
    expected = ref[0, :].max()
    calls, stacks = [], []
    chunk = routes_spectrogram.stft_chunk
    stack = np.stack

    def observed_chunk(data, start, end, *args):
        calls.append((start, end))
        return chunk(data, start, end, *args)

    def observed_stack(arrays, *args, **kwargs):
        stacks.append(len(arrays))
        return stack(arrays, *args, **kwargs)

    monkeypatch.setattr(routes_spectrogram, "stft_chunk", observed_chunk)
    monkeypatch.setattr(np, "stack", observed_stack)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        result, _ = query(
            client,
            lane,
            t0=0,
            t1=0.02,
            width=1,
            height=1,
            f_hi=1,
            n_fft=32768,
            win_length=32,
            hop=1,
        )
    assert result[0, 0] == expected
    assert calls == [(0, 255), (255, 510), (510, 513)] * 2
    assert not stacks


def test_failed_flight_propagates_and_next_request_succeeds(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    path = tmp_path / "signal.wav"
    sf.write(path, np.ones(124, dtype=np.float32), 32, subtype="FLOAT")
    app = create_app("secret", "cpu", [str(path)])
    original = routes_spectrogram.build_entry
    entered, waiting, release = Event(), Event(), Event()
    calls = []

    def fail_first(*args):
        calls.append(1)
        if len(calls) == 1:
            entered.set()
            assert release.wait(10)
            raise ValueError("flight failed")
        return original(*args)

    monkeypatch.setattr(routes_spectrogram, "build_entry", fail_first)
    with TestClient(app, raise_server_exceptions=False) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        observe_flight_waiters(monkeypatch, app, waiting)
        params = dict(
            t0=0,
            t1=2,
            width=4,
            height=5,
            f_lo=0,
            f_hi=16,
            yscale="linear",
            channel=0,
            mode="stft",
            n_fft=8,
            win_length=6,
            hop=4,
            window="hann",
            window_param=0,
        )
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(
                client.get, f"/api/lanes/{lane}/spectrogram", params=params, headers=HEADERS
            )
            assert entered.wait(10)
            second = pool.submit(
                client.get, f"/api/lanes/{lane}/spectrogram", params=params, headers=HEADERS
            )
            try:
                assert waiting.wait(10)
            finally:
                release.set()
            responses = [first.result(timeout=20), second.result(timeout=20)]
        assert [r.status_code for r in responses] == [500, 500]
        assert [r.json()["detail"] for r in responses] == ["flight failed", "flight failed"]
        assert len(calls) == 1
        assert (
            client.get(f"/api/lanes/{lane}/spectrogram", params=params, headers=HEADERS).status_code
            == 200
        )
        assert len(calls) == 2


def log_response(client, lane, **changes):
    params = dict(
        t0=0.00224,
        t1=0.00226,
        width=1,
        height=1,
        f_lo=16000 / 9,
        f_hi=3500,
        yscale="log",
        channel=0,
        mode="stft",
        n_fft=9,
        win_length=9,
        hop=9,
        window="hann",
        window_param=0,
    )
    params.update(changes)
    return client.get(f"/api/lanes/{lane}/spectrogram", params=params, headers=HEADERS)


def assert_validation(response):
    assert response.status_code == 422
    assert set(response.json()) == {"error", "detail", "traceback"}


def test_odd_log_empty_bands_above_last_bin(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = (np.cos(2 * np.pi * 4 * np.arange(72) / 9) / 3).astype(np.float32)
    path = tmp_path / "tone.wav"
    sf.write(path, samples, 9000, subtype="FLOAT")
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        response = log_response(
            client, lane, t0=0.00395, t1=0.00405, height=2, f_lo=4050, f_hi=4400
        )
        assert_validation(response)


@pytest.mark.parametrize("edge", ["zero", "below", "equal", "above"])
def test_log_physical_lower_edge_keeps_first_bin(tmp_path, monkeypatch, edge):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = (np.cos(2 * np.pi * np.arange(72) / 9) / 3).astype(np.float32)
    path = tmp_path / "tone.wav"
    sf.write(path, samples, 16000, subtype="FLOAT")
    ref = reference(samples, 9, 9, 9).astype(np.float16)
    minimum = 16000 / 9
    low = {
        "zero": 0,
        "below": np.nextafter(minimum, -np.inf),
        "equal": minimum,
        "above": np.nextafter(minimum, np.inf),
    }[edge]
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        response = log_response(client, lane, f_lo=low)
        if edge in ("zero", "below"):
            assert_validation(response)
        else:
            assert response.status_code == 200
            values, meta = decode_frame(response.content)
            center = np.sqrt(low * 3500)
            assert meta["f_axis"]["lo"] == low
            assert meta["row_freqs"][0] == pytest.approx(center, abs=1e-10)
            if edge == "equal":
                assert values[0, 0] == ref[1, 4]
            else:
                weight = (center - minimum) / (32000 / 9 - minimum)
                expected = np.float16(
                    np.float32(ref[1, 4]) * (1 - weight) + np.float32(ref[2, 4]) * weight
                )
                assert values[0, 0] == expected


def test_log_twenty_hz_minimum(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = (np.cos(2 * np.pi * 2 * np.arange(1280) / 160) / 3).astype(np.float32)
    path = tmp_path / "tone.wav"
    sf.write(path, samples, 1600, subtype="FLOAT")
    ref = reference(samples, 160, 160, 160).astype(np.float16)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        params = dict(t0=0.399, t1=0.401, f_hi=35, n_fft=160, win_length=160, hop=160)
        assert_validation(log_response(client, lane, f_lo=np.nextafter(20.0, -np.inf), **params))
        response = log_response(client, lane, f_lo=20, **params)
        assert response.status_code == 200
        values, meta = decode_frame(response.content)
        assert values[0, 0] == ref[2:4, 4].max()
        assert meta["f_axis"]["lo"] == 20


def test_log_exact_and_neighboring_shared_edges(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    samples = (np.cos(2 * np.pi * 2 * np.arange(1280) / 160) / 3).astype(np.float32)
    path = tmp_path / "tone.wav"
    sf.write(path, samples, 16000, subtype="FLOAT")
    ref = reference(samples, 160, 160, 160).astype(np.float16)
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=HEADERS).json()["lanes"][0]["id"]
        params = dict(t0=0.0399, t1=0.0401, f_lo=100, n_fft=160, win_length=160, hop=160)
        for high, expected_bins in (
            (np.nextafter(400.0, -np.inf), (1, 2)),
            (400.0, (1, 2)),
            (np.nextafter(400.0, np.inf), (2, 3)),
        ):
            response = log_response(client, lane, f_hi=high, height=2, **params)
            assert response.status_code == 200
            values, meta = decode_frame(response.content)
            np.testing.assert_array_equal(values[:, 0], ref[list(expected_bins), 4])
            assert meta["f_axis"]["hi"] == high
            np.testing.assert_allclose(
                meta["row_freqs"],
                [100 * (high / 100) ** 0.25, 100 * (high / 100) ** 0.75],
                rtol=0,
                atol=1e-10,
            )
        response = log_response(client, lane, f_hi=200, **params)
        assert response.status_code == 200
        values, _ = decode_frame(response.content)
        assert values[0, 0] == ref[1, 4]
