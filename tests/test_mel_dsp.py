import librosa
import numpy as np
import pytest
import torch

import vsr.api as api
from vsr.dsp import mel_db
from vsr.dsp.mel import mel_chunk, mel_filterbank
from vsr.dsp.stft import window_tensor


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
    return api.compute_device()


def assert_mel_power(db, expected_power):
    actual_power = np.power(np.float32(10), db.numpy() / 10)
    mask = expected_power > expected_power.max() * 1e-6
    relative_error = np.abs(actual_power[mask] / expected_power[mask] - 1).max()
    assert relative_error < 1e-4, f"maximum relative power error: {relative_error}"


def test_calibrated_hann_mel_matches_librosa(device):
    sr, n_fft, win_length, hop = 16000, 512, 256, 64
    n_mels, fmin, fmax = 40, 0, 8000
    x = np.random.default_rng(519).normal(size=(2, 4096)).astype(np.float32)
    params = dict(
        n_fft=n_fft, win_length=win_length, n_mels=n_mels, fmin=fmin, fmax=fmax, htk=False
    )
    db, times, freqs = mel_db(x, sr, **params, hop=hop, window="hann")
    expected = (
        librosa.feature.melspectrogram(
            y=x,
            sr=sr,
            **params,
            hop_length=hop,
            window="hann",
            center=True,
            pad_mode="constant",
            power=2.0,
            norm="slaney",
        )
        / 4096
    )  # Periodic Hann sum is 128.

    assert db.shape == (2, n_mels, 65)
    assert all(t.device.type == "cpu" and t.dtype == torch.float32 for t in (db, times, freqs))
    assert_mel_power(db, expected)
    np.testing.assert_allclose(times, np.arange(65) / 250)
    np.testing.assert_allclose(
        freqs, librosa.mel_frequencies(42, fmin=fmin, fmax=fmax, htk=False)[1:-1]
    )


def test_short_htk_mel_matches_librosa(device):
    sr, n_fft, win_length, hop = 16000, 513, 255, 71
    x = torch.from_numpy(np.random.default_rng(71).normal(size=129).astype(np.float32))
    params = dict(n_fft=n_fft, win_length=win_length, n_mels=24, fmin=80, fmax=7000, htk=True)
    db, times, freqs = mel_db(x, sr, **params, hop=hop, window="hann")
    with pytest.warns(UserWarning, match="n_fft=513 is too large"):
        expected = (
            librosa.feature.melspectrogram(
                y=x.numpy(),
                sr=sr,
                **params,
                hop_length=hop,
                window="hann",
                center=True,
                pad_mode="constant",
                power=2.0,
                norm="slaney",
            )
            * (4 / win_length) ** 2
        )
    assert db.shape == (1, 24, 2)
    assert_mel_power(db[0], expected)
    np.testing.assert_allclose(times, [0, hop / sr])
    np.testing.assert_allclose(
        freqs, librosa.mel_frequencies(26, fmin=80, fmax=7000, htk=True)[1:-1]
    )


@pytest.mark.parametrize(
    "n_fft,win_length,hop,samples,window,window_param",
    [(512, 256, 64, 2304, "kaiser", 8.6), (513, 255, 71, 2047, "gaussian", 0.125)],
)
def test_mel_chunks_match_complete_grid(
    device, n_fft, win_length, hop, samples, window, window_param
):
    sr, n_mels, fmin, fmax = 16000, 40, 0, 7600
    x = torch.from_numpy(np.random.default_rng(94).normal(size=samples).astype(np.float32))
    db, _, _ = mel_db(
        x,
        sr,
        n_fft=n_fft,
        win_length=win_length,
        hop=hop,
        window=window,
        window_param=window_param,
        n_mels=n_mels,
        fmin=fmin,
        fmax=fmax,
        htk=False,
    )
    w = window_tensor(window, win_length, window_param)
    bank = mel_filterbank(sr, n_fft, n_mels, fmin, fmax, False, device)
    frames = 1 + (samples - n_fft % 2) // hop
    edges = [0, 1, 9, frames - 1, frames]
    chunks = [
        mel_chunk(x, start, end, n_fft, hop, w, bank)
        for start, end in zip(edges[:-1], edges[1:], strict=True)
    ]
    power = np.power(np.float32(10), db[0].numpy() / 10)
    assert_mel_power(torch.cat(chunks, dim=-1), power)


def test_mel_silence_floor_and_default_geometry(device):
    db, times, freqs = mel_db(np.zeros(193, dtype=np.float32), 16000)
    assert db.shape == (1, 128, 2)
    np.testing.assert_array_equal(db, -200)
    np.testing.assert_allclose(times, [0, 128 / 16000])
    np.testing.assert_allclose(freqs, librosa.mel_frequencies(130, fmin=0, fmax=8000)[1:-1])
