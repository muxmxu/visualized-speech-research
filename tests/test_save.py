import numpy as np
import pytest
import soundfile as sf
import torch
from fastapi.testclient import TestClient

from vsr.server.app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "state"))
    with TestClient(
        create_app("secret", "cpu"),
        headers={"Authorization": "Bearer secret"},
        raise_server_exceptions=False,
    ) as live:
        yield live


def open_audio(client, path):
    response = client.post("/api/open", json={"paths": [str(path)]})
    assert response.status_code == 200, response.text
    return response.json()["lanes"][0]


def invert(client, lane):
    response = client.post(f"/api/lanes/{lane['id']}/edit", json={"op": "invert"})
    assert response.status_code == 200, response.text
    assert response.json()["lanes"][0]["dirty"]


@pytest.mark.parametrize("kind", ["pt", "mp3", "shared-wav"])
def test_implicit_save_requires_unique_wav_or_flac(client, tmp_path, kind):
    audio = np.sin(2 * np.pi * 440 * np.arange(8000) / 8000).astype(np.float32) / 2
    path = tmp_path / f"source.{kind if kind != 'shared-wav' else 'wav'}"
    if kind == "pt":
        torch.save(torch.from_numpy(audio), path)
        response = client.post(
            "/api/open_tensor",
            json={
                "path": str(path),
                "key_path": [],
                "interpretation": {"kind": "audio", "sr": 8000, "layout": "[N]"},
            },
        )
        assert response.status_code == 200, response.text
        lane = response.json()["lanes"][0]
    else:
        sf.write(path, audio, 8000)
        lane = open_audio(client, path)
        if kind == "shared-wav":
            open_audio(client, path)
    original = path.read_bytes()
    response = client.post(f"/api/lanes/{lane['id']}/save", json={"subtype": "PCM_24"})
    assert response.status_code == 400, response.text
    assert "Save As" in response.json()["detail"]
    assert path.read_bytes() == original


@pytest.mark.parametrize(("subtype", "extension"), [("PCM_24", "flac"), ("FLOAT", "wav")])
def test_save_subtype_roundtrip(client, tmp_path, subtype, extension):
    sr = 8000
    x = np.random.default_rng(42).uniform(-0.75, 0.75, (640, 2)).astype(np.float32)
    source = tmp_path / "source.wav"
    sf.write(source, x, sr, subtype="FLOAT")
    original = source.read_bytes()
    lane = open_audio(client, source)
    invert(client, lane)
    assert source.read_bytes() == original
    target = tmp_path / f"saved.{extension}" if extension == "flac" else source
    payload = {"subtype": subtype} | ({"path": str(target)} if target != source else {})
    response = client.post(f"/api/lanes/{lane['id']}/save", json=payload)
    assert response.status_code == 200, response.text
    assert not response.json()["lanes"][0]["dirty"]
    y, sample_rate = sf.read(target, dtype="float32")
    assert sample_rate == sr and sf.info(target).subtype == subtype
    if subtype == "PCM_24":
        np.testing.assert_allclose(y, -x, atol=2**-23, rtol=0)
        assert source.read_bytes() == original
    else:
        np.testing.assert_array_equal(y, -x)


def test_interrupted_save_preserves_original(client, tmp_path, monkeypatch):
    path = tmp_path / "original.wav"
    sf.write(path, np.linspace(-0.5, 0.5, 100, dtype=np.float32), 8000, subtype="FLOAT")
    original = path.read_bytes()
    lane = open_audio(client, path)
    invert(client, lane)
    endpoint = f"/api/lanes/{lane['id']}/save"
    alias = tmp_path / "alias.wav"
    alias.symlink_to(path)
    explicit = client.post(endpoint, json={"path": str(alias), "subtype": "FLOAT"})
    assert explicit.status_code == 400 and "Use Save" in explicit.json()["detail"]
    assert path.read_bytes() == original
    write = sf.write

    def interrupted(temporary, data, sr, **kwargs):
        assert temporary.parent == path.parent and temporary != path
        write(temporary, data[: len(data) // 2], sr, **kwargs)
        raise OSError("interrupted write")

    monkeypatch.setattr(sf, "write", interrupted)
    response = client.post(endpoint, json={"subtype": "FLOAT"})
    assert response.status_code == 500, response.text
    assert response.json()["detail"] == "interrupted write"
    assert path.read_bytes() == original
    assert set(tmp_path.glob("*.wav")) == {path, alias}
    assert not list(tmp_path.glob("*.tmp"))
    assert client.get("/api/session").json()["lanes"][0]["dirty"]
