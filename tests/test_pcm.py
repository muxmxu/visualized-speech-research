import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient
from scipy.signal import resample_poly

from vsr.frame import decode_frame
from vsr.server.app import create_app


def test_pcm_reference_and_adjacent_chunks(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    rng = np.random.default_rng(42)
    source = rng.normal(0, 0.1, 48_000 * 21).astype(np.float32)
    path = tmp_path / "signal.wav"
    sf.write(path, source, 48000, subtype="FLOAT")
    reference = resample_poly(source, 44100, 48000)
    with TestClient(create_app("secret", "cpu")) as client:
        headers = {"Authorization": "Bearer secret"}
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]["id"]
        for t0, t1 in [(0, 21), (19, 20), (20, 21)]:
            response = client.get(
                f"/api/lanes/{lane}/pcm", params={"t0": t0, "t1": t1, "sr": 44100}, headers=headers
            )
            actual, _ = decode_frame(response.content)
            np.testing.assert_array_equal(actual[0], reference[t0 * 44100 : t1 * 44100])


def test_pcm_same_rate(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    source = np.array([0, 1, 0, -1, 0, 1, 0, -1], dtype=np.float32)
    path = tmp_path / "simple.wav"
    sf.write(path, source, 4, subtype="FLOAT")
    with TestClient(create_app("secret", "cpu")) as client:
        headers = {"Authorization": "Bearer secret"}
        lane = client.post("/api/open", json={"paths": [str(path)]}, headers=headers).json()[
            "lanes"
        ][0]["id"]
        response = client.get(
            f"/api/lanes/{lane}/pcm", params={"t0": 0.5, "t1": 1.5, "sr": 4}, headers=headers
        )
        actual, _ = decode_frame(response.content)
        np.testing.assert_array_equal(actual, [[0, -1, 0, 1]])
