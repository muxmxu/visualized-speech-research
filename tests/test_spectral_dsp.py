import numpy as np
import pytest
import soundfile as sf
import torch
from fastapi.testclient import TestClient
from scipy import signal

import vsr.api as api
from vsr.dsp import active_frames, stft_db, welch
from vsr.dsp.spectrum import spectrum
from vsr.frame import decode_frame
from vsr.server.app import create_app


@pytest.fixture(
    params=[
        "cpu",
        pytest.param(
            "cuda",
            marks=pytest.mark.skipif(
                not torch.cuda.is_available(), reason="CUDA device unavailable"
            ),
        ),
        pytest.param(
            "mps",
            marks=pytest.mark.skipif(
                not torch.backends.mps.is_available(), reason="MPS device unavailable"
            ),
        ),
    ]
)
def device(request, monkeypatch):
    monkeypatch.setattr(api, "_device", request.param)
    return request.param


@pytest.mark.parametrize(
    "window,param", [("hann", None), ("blackmanharris", None), ("kaiser", 8.6)]
)
def test_stft_calibration(device, window, param):
    sr = 16000
    x = np.sin(2 * np.pi * 1000 * np.arange(sr) / sr).astype(np.float32)
    db, times, freqs = stft_db(
        x, sr, n_fft=512, win_length=512, hop=128, window=window, window_param=param
    )
    assert np.max(np.abs(db[0, 32, 2:-2].numpy())) < 0.05
    assert times[2].item() == pytest.approx(256 / sr)
    assert freqs[32].item() == 1000
    assert db.device.type == "cpu"


@pytest.mark.parametrize(
    "unit,scaling,offset", [("dbfs", "spectrum", 3.0102999566), ("db_per_hz", "density", 0)]
)
def test_welch_scipy(device, unit, scaling, offset):
    sr = 16000
    x = np.random.default_rng(345).normal(size=16000).astype(np.float32)
    w = signal.get_window("hann", 512, fftbins=True)
    freqs, expected = signal.welch(
        x, fs=sr, window=w, nperseg=512, noverlap=384, nfft=512, detrend=False, scaling=scaling
    )
    values, actual_freqs = welch(x, sr, n_fft=512, win_length=512, hop=128, unit=unit)
    error = np.abs(values[0, 0, 1:-1].numpy() - (10 * np.log10(expected[1:-1]) + offset))
    assert np.max(error) < 0.05
    np.testing.assert_allclose(actual_freqs, freqs)


def test_statistics_and_full(device):
    sr = 16000
    x = np.sin(2 * np.pi * 1000 * np.arange(512) / sr).astype(np.float32)
    values, freqs = spectrum(x, sr, method="full")
    assert values[0, 0, 32].item() == pytest.approx(20 * np.log10(256), abs=0.05)
    assert freqs[32] == 1000
    values, _ = welch(
        np.tile(x, 4),
        sr,
        n_fft=512,
        win_length=512,
        hop=128,
        stats=("mean", "median", "p10", "p90", "max"),
    )
    np.testing.assert_allclose(values[0, :, 32], 0, atol=0.05)


def test_activity(device):
    sr = 16000
    x = np.repeat(np.array([0.5, 0.001, 0], dtype=np.float32), sr)
    times, active = active_frames(x, sr)
    assert active[(times > 0.1) & (times < 0.9)].all()
    assert not active[(times > 1.1) & (times < 2.9)].any()
    values, _ = welch(x, sr, n_fft=320, win_length=320, hop=160, window="hamming", active_only=True)
    assert values[0, 0, 0].item() == pytest.approx(0, abs=0.05)


def test_spectrum_route(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    sr = 16000
    path = tmp_path / "tone.wav"
    sf.write(
        path, np.sin(2 * np.pi * 1000 * np.arange(sr) / sr).astype(np.float32), sr, subtype="FLOAT"
    )
    headers = {"Authorization": "Bearer secret"}
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=headers).json()["lanes"][0]
        url = f"/api/lanes/{lane['id']}/spectrum"
        body = {
            "t0": 0,
            "t1": 1,
            "channel": 0,
            "method": "welch",
            "n_fft": 512,
            "win_length": 512,
            "hop": 128,
            "window": "hann",
            "window_param": 0,
            "stats": ["mean", "max"],
            "unit": "dbfs",
            "active_only": False,
        }
        assert client.post(url, json=body).status_code == 401
        assert client.post(url, headers=headers, json=body | {"win_length": 513}).status_code == 422
        response = client.post(url, headers=headers, json=body)
        assert response.status_code == 200
        arrays, meta = decode_frame(response.content)
        assert meta["unit"] == "dbfs" and meta["stats"] == ["mean", "max"]
        assert arrays["values"].shape == (2, 257)
        assert arrays["freqs"][32] == 1000
        np.testing.assert_allclose(arrays["values"][:, 32], 0, atol=0.05)


def test_frame_and_statistics_against_scipy(device):
    sr = 16000
    rng = np.random.default_rng(198)
    x = rng.normal(size=4096).astype(np.float32)
    w = signal.get_window("hamming", 256, fftbins=True)
    frames = np.lib.stride_tricks.sliding_window_view(x, 256)[::128]
    power = (np.abs(np.fft.rfft(frames * w, n=512, axis=-1)) * 2 / w.sum()) ** 2
    db = 10 * np.log10(np.maximum(power, 1e-20))
    expected = np.stack(
        [
            10 * np.log10(power.mean(axis=0)),
            np.quantile(db, 0.5, axis=0),
            np.quantile(db, 0.1, axis=0),
            np.quantile(db, 0.9, axis=0),
            db.max(axis=0),
        ]
    )
    values, _ = welch(
        x,
        sr,
        n_fft=512,
        win_length=256,
        hop=128,
        window="hamming",
        stats=("mean", "median", "p10", "p90", "max"),
    )
    np.testing.assert_allclose(values[0], expected, atol=0.05)
    values, _ = spectrum(
        x, sr, method="frame", t0=512 / sr, n_fft=512, win_length=256, window="hamming"
    )
    expected_frame = 20 * np.log10(
        np.maximum(np.abs(np.fft.rfft(x[384:640] * w, n=512)) * 2 / w.sum(), 1e-10)
    )
    np.testing.assert_allclose(values[0, 0], expected_frame, atol=0.05)


def test_quiet_psd_and_strict_tolerance(device):
    sr = 16000
    x = (1e-10 * np.sin(2 * np.pi * 1000 * np.arange(4096) / sr)).astype(np.float32)
    w = signal.get_window("hann", 512)
    _, reference = signal.welch(
        x, fs=sr, window=w, nperseg=512, noverlap=384, nfft=512, detrend=False, scaling="density"
    )
    for stat in ("mean", "median", "max"):
        values, _ = welch(
            x, sr, n_fft=512, win_length=512, hop=128, unit="db_per_hz", stats=(stat,)
        )
        assert abs(values[0, 0, 32].item() - 10 * np.log10(reference[32])) < 0.05


def test_activity_inclusive_sample_edge_and_empty(device):
    x = np.zeros(640, dtype=np.float32)
    x[160:320] = 1
    # Activity frame at sample 320 is active; the analyzed frame is centered at 400.
    values, _ = welch(
        x,
        16000,
        t0=320 / 16000,
        t1=480 / 16000,
        n_fft=160,
        win_length=160,
        hop=160,
        active_only=True,
    )
    assert np.isfinite(values.numpy()).all()
    for length in (0, 100):
        times, active = active_frames(np.zeros(length, dtype=np.float32), 16000)
        assert times.numel() == active.numel() == 0
    for stat in ("mean", "median"):
        with pytest.raises(ValueError, match="eligible"):
            welch(
                np.zeros(640, dtype=np.float32),
                16000,
                n_fft=320,
                win_length=320,
                active_only=True,
                stats=(stat,),
            )


def test_numpy_views_window_validation_and_dtype(device):
    x = np.arange(2048, dtype=np.float32)[::-1]
    db, times, freqs = stft_db(x, 16000, n_fft=256)
    assert db.shape[-1] > 0 and times.dtype == freqs.dtype == torch.float32
    assert welch(x, 16000, n_fft=256)[0].shape[-1] == 129
    with pytest.raises(ValueError, match="window"):
        stft_db(x, 16000, n_fft=256, window="boxcar")
    with pytest.raises(ValueError, match="window"):
        welch(x, 16000, n_fft=256, window="boxcar")
    with pytest.raises((ValueError, TypeError), match="method"):
        welch(x, 16000, method="full")
    old = torch.get_default_dtype()
    try:
        torch.set_default_dtype(torch.float64)
        assert stft_db(x, 16000, n_fft=256)[2].dtype == torch.float32
        assert welch(x, 16000, n_fft=256)[1].dtype == torch.float32
        assert spectrum(x, 16000, method="full")[1].dtype == torch.float32
    finally:
        torch.set_default_dtype(old)


def test_full_cap_rejects_excess(device):
    x = np.zeros(2**24 + 1, dtype=np.float32)
    x[-1] = 1
    with pytest.raises(ValueError, match="2\\^24"):
        spectrum(x, 16000, method="full")


def test_spectrum_route_methods_and_empty(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    sr = 16000
    path = tmp_path / "signal.wav"
    x = np.sin(2 * np.pi * 1000 * np.arange(sr) / sr).astype(np.float32)
    sf.write(path, x, sr, subtype="FLOAT")
    headers = {"Authorization": "Bearer secret"}
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=headers).json()["lanes"][0]
        url = f"/api/lanes/{lane['id']}/spectrum"
        body = {
            "t0": 0.5,
            "t1": 0.500001,
            "channel": 0,
            "method": "frame",
            "n_fft": 512,
            "win_length": 512,
            "hop": 1024,
            "window": "hann",
            "window_param": 0,
            "stats": ["mean", "p90"],
            "unit": "db_per_hz",
            "active_only": False,
        }
        response = client.post(url, headers=headers, json=body)
        assert response.status_code == 200
        arrays, meta = decode_frame(response.content)
        assert meta["unit"] == "dbfs" and meta["stats"] == ["frame"]
        assert arrays["values"].shape[0] == 1
        assert abs(arrays["values"][0, 32]) < 0.05
        response = client.post(
            url,
            headers=headers,
            json=body | {"method": "full", "t0": 0, "t1": 512 / sr, "window": "boxcar"},
        )
        assert response.status_code == 200
        arrays, meta = decode_frame(response.content)
        assert meta["unit"] == "db" and meta["stats"] == ["full"]
        assert arrays["values"].shape[0] == 1
        response = client.post(
            url,
            headers=headers,
            json=body
            | {"method": "welch", "t0": 0, "t1": 1, "hop": 1024, "unit": "dbfs", "stats": ["mean"]},
        )
        assert response.status_code == 200
        silent = tmp_path / "silent.wav"
        sf.write(silent, np.zeros(sr, np.float32), sr)
        opened = client.post("/api/open", headers=headers, json={"paths": [str(silent)]}).json()
        silent_url = f"/api/lanes/{opened['lanes'][0]['id']}/spectrum"
        for stat in ("mean", "median"):
            response = client.post(
                silent_url,
                headers=headers,
                json=body
                | {"method": "welch", "t0": 0, "t1": 1, "stats": [stat], "active_only": True},
            )
            assert response.status_code == 422
            assert "eligible" in response.json()["detail"]


def test_full_cap_exact_boundary_and_http(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    length = 2**24
    x = np.zeros(length, dtype=np.float32)
    x[-1] = 1
    values, freqs = spectrum(x, 16000, method="full")
    assert values.shape == (1, 1, length // 2 + 1)
    assert freqs.shape == (length // 2 + 1,)
    assert abs(values[0, 0, 12345].item()) < 0.05
    del values, freqs
    path = tmp_path / "long.wav"
    with sf.SoundFile(path, mode="w", samplerate=16000, channels=1, subtype="FLOAT") as f:
        f.write(x)
        f.write(np.ones(1, dtype=np.float32))
    headers = {"Authorization": "Bearer secret"}
    with TestClient(create_app("secret", "cpu", [str(path)])) as client:
        lane = client.get("/api/session", headers=headers).json()["lanes"][0]
        response = client.post(
            f"/api/lanes/{lane['id']}/spectrum",
            headers=headers,
            json={
                "t0": 0,
                "t1": (length + 1) / 16000,
                "channel": 0,
                "method": "full",
                "n_fft": 512,
                "win_length": 512,
                "hop": 128,
                "window": "boxcar",
                "window_param": 0,
                "stats": ["mean"],
                "unit": "dbfs",
                "active_only": False,
            },
        )
        assert response.status_code == 422
        assert "2^24" in response.json()["detail"]


@pytest.mark.parametrize("amplitudes", [(0, 1, 2, 3, 4), (0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9)])
def test_welch_zero_psd_public(device, amplitudes):
    sr, size = 16000, 512
    stats = ("mean", "median", "p10", "p90", "max")
    values, _ = welch(
        np.zeros(1024, dtype=np.float32),
        sr,
        stats=stats,
        unit="db_per_hz",
        n_fft=size,
        win_length=size,
        hop=128,
    )
    zero_values = values
    x = np.repeat(np.array(amplitudes, dtype=np.float32), size)
    values, _ = welch(x, sr, stats=stats, unit="db_per_hz", n_fft=size, win_length=size, hop=size)
    window = signal.get_window("hann", size)
    base = 10 * np.log10(2 * window.sum() ** 2 / (sr * np.sum(window**2)))
    assert torch.isneginf(values[0, 2, 0])
    if len(amplitudes) == 5:
        median = base + 20 * np.log10(2)
        p90 = 0.4 * (base + 20 * np.log10(3)) + 0.6 * (base + 20 * np.log10(4))
    else:
        median = base + 20 * np.log10(4)
        p90 = base + 20 * np.log10(8)
    assert abs(values[0, 1, 0].item() - median) < 0.05
    assert abs(values[0, 3, 0].item() - p90) < 0.05
    assert torch.isneginf(zero_values).all()


@pytest.mark.parametrize("amplitudes", [(0, 1, 2, 3, 4), (0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9)])
def test_welch_zero_psd_framed_route(tmp_path, monkeypatch, amplitudes):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    sr, size = 16000, 512
    zero = tmp_path / "zero.wav"
    mixed = tmp_path / "mixed.wav"
    sf.write(zero, np.zeros(1024, np.float32), sr, subtype="FLOAT")
    sf.write(mixed, np.repeat(np.array(amplitudes, np.float32), size), sr, subtype="FLOAT")
    headers = {"Authorization": "Bearer secret"}
    stats = ["mean", "median", "p10", "p90", "max"]
    with TestClient(create_app("secret", "cpu", [str(zero), str(mixed)])) as client:
        lanes = client.get("/api/session", headers=headers).json()["lanes"]
        body = {
            "t0": 0,
            "t1": 1024 / sr,
            "channel": 0,
            "method": "welch",
            "n_fft": size,
            "win_length": size,
            "hop": 128,
            "window": "hann",
            "window_param": 0,
            "stats": stats,
            "unit": "db_per_hz",
            "active_only": False,
        }
        response = client.post(f"/api/lanes/{lanes[0]['id']}/spectrum", headers=headers, json=body)
        assert response.status_code == 200
        arrays, meta = decode_frame(response.content)
        assert meta["stats"] == stats and meta["unit"] == "db_per_hz"
        zero_values = arrays["values"]
        response = client.post(
            f"/api/lanes/{lanes[1]['id']}/spectrum",
            headers=headers,
            json=body | {"t1": len(amplitudes) * size / sr, "hop": size},
        )
        assert response.status_code == 200
        arrays, _ = decode_frame(response.content)
        values = arrays["values"]
        window = signal.get_window("hann", size)
        base = 10 * np.log10(2 * window.sum() ** 2 / (sr * np.sum(window**2)))
        assert np.isneginf(values[2, 0])
        if len(amplitudes) == 5:
            median = base + 20 * np.log10(2)
            p90 = 0.4 * (base + 20 * np.log10(3)) + 0.6 * (base + 20 * np.log10(4))
        else:
            median = base + 20 * np.log10(4)
            p90 = base + 20 * np.log10(8)
        assert abs(values[1, 0] - median) < 0.05
        assert abs(values[3, 0] - p90) < 0.05
        assert np.isneginf(zero_values).all()
