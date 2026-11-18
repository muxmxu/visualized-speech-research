import numpy as np
import pytest
import torch
from scipy.signal import get_window, resample_poly

from vsr.dsp.edit import masked_interval, spectral_mask

DEVICES = [
    "cpu",
    pytest.param(
        "cuda", marks=pytest.mark.skipif(not torch.cuda.is_available(), reason="CUDA unavailable")
    ),
    pytest.param(
        "mps",
        marks=pytest.mark.skipif(not torch.backends.mps.is_available(), reason="MPS unavailable"),
    ),
]


def oracle(x, sr, n_fft, win_length, window, param, t0, t1, f_lo, f_hi, output_sr=None):
    spec = (
        (window, param * win_length if window == "gaussian" else param)
        if window in {"gaussian", "kaiser"}
        else window
    )
    w = torch.from_numpy(get_window(spec, win_length, fftbins=True).astype(np.float32))
    hop = win_length // 4
    transform = torch.stft(
        torch.from_numpy(x),
        n_fft,
        hop_length=hop,
        win_length=win_length,
        window=w,
        center=True,
        pad_mode="constant",
        return_complex=True,
    )

    def axis(coords, lo, hi, step):
        d = np.maximum(np.maximum(lo - coords, coords - hi), 0)
        return np.where(d < 2 * step, (1 + np.cos(np.pi * d / (2 * step))) / 2, 0)

    t = axis(np.arange(transform.shape[-1], dtype=np.float64) * hop / sr, t0, t1, hop / sr)
    f = axis(np.arange(transform.shape[-2], dtype=np.float64) * sr / n_fft, f_lo, f_hi, sr / n_fft)
    mask = torch.from_numpy((f[:, None] * t[None, :]).astype(np.float32))
    y = torch.istft(
        transform * mask,
        n_fft,
        hop_length=hop,
        win_length=win_length,
        window=w,
        center=True,
        length=x.shape[-1],
    ).numpy()
    return resample_poly(y, output_sr, sr, axis=-1) if output_sr and output_sr != sr else y


@pytest.mark.parametrize("device", DEVICES)
def test_mask_weights_and_grid(device):
    weights = spectral_mask(0, 12, 12, 1, 1, 1, 4, 8, 4, 8, device).cpu().numpy()
    np.testing.assert_allclose(
        weights[5, [1, 2, 3, 4, 5, 8, 9, 10, 11]], [0, 0, 0.5, 1, 1, 1, 0.5, 0, 0], atol=1e-7
    )
    assert abs(weights[3, 3] - 0.25) < 1e-7
    fractional = spectral_mask(0, 10, 1, 1, 1, 1, 4.5, 8, 0, 1, device).cpu().numpy()[0]
    np.testing.assert_allclose(
        fractional[[4, 3, 2]], [(1 + np.sqrt(2) / 2) / 2, (1 - np.sqrt(2) / 2) / 2, 0], atol=1e-7
    )
    overlap = spectral_mask(3, 5, 12, 1, 1, 1, 4, 8, 4, 8, device).cpu().numpy()
    np.testing.assert_array_equal(overlap, weights[:, 3:8])


@pytest.mark.parametrize("device", DEVICES)
@pytest.mark.parametrize("n_fft", [32, 33])
def test_bounded_inverse_matches_whole_lane(device, n_fft):
    x = np.random.default_rng(42).normal(0, 0.1, (1, 100)).astype(np.float32)
    expected = oracle(x, 100, n_fft, 21, "hann", 0, 0.2, 0.8, 10, 30)
    actual = masked_interval(
        torch.from_numpy(x), 100, 0, 11, 93, 100, n_fft, 21, "hann", 0, 0.2, 0.8, 10, 30, device
    )
    np.testing.assert_allclose(actual, expected[:, 11:93], atol=1e-6, rtol=0)
