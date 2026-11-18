"""Shared calibrated short-time Fourier transforms."""

import numpy as np
import torch
from scipy.signal import get_window

from vsr.api import compute_device
from vsr.presets import resolve_preset


def input_tensor(x):
    if isinstance(x, np.ndarray):
        x = np.ascontiguousarray(x)
    x = torch.as_tensor(x, dtype=torch.float32, device=compute_device())
    if x.ndim == 1:
        x = x.unsqueeze(0)
    if x.ndim != 2:
        raise ValueError("Audio must have shape [N] or [C, N]")
    return x


def _window_tensor(window, win_length, window_param, device):
    if window == "kaiser":
        window = (window, 8.6 if window_param is None else window_param)
    elif window == "gaussian":
        window = (window, (0.125 if window_param is None else window_param) * win_length)
    w = get_window(window, win_length, fftbins=True)
    return torch.as_tensor(np.array(w), dtype=torch.float32, device=device)


def window_tensor(window, win_length, window_param):
    return _window_tensor(window, win_length, window_param, compute_device())


def _calibrated_db(transform, window):
    amplitude = transform.abs() * (2 / window.sum())
    return 20 * torch.log10(torch.clamp(amplitude, min=1e-10))  # DESIGN §8.1


def stft_db(x, sr, **params) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    defaults = resolve_preset("analysis", sr)
    n_fft = params.get("n_fft", defaults["n_fft"])
    win_length = params.get("win_length", n_fft)
    hop = params.get("hop", win_length // 4)
    window = params.get("window", "hann")
    if window not in {"hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian"}:
        raise ValueError("Invalid STFT window")
    x = input_tensor(x)
    w = window_tensor(window, win_length, params.get("window_param"))
    transform = torch.stft(
        x,
        n_fft,
        hop_length=hop,
        win_length=win_length,
        window=w,
        center=True,
        pad_mode="constant",
        return_complex=True,
    )
    db = _calibrated_db(transform, w)
    times = torch.arange(db.shape[-1], device=compute_device(), dtype=torch.float32) * hop / sr
    freqs = torch.fft.rfftfreq(n_fft, 1 / sr, device=compute_device(), dtype=torch.float32)
    return db.cpu(), times.cpu(), freqs.cpu()


def stft_chunk(data, start, end, n_fft, win_length, hop, window, window_param, device):
    """Calculate absolute centered frames from a bounded source slice."""
    q = n_fft // 2
    left = start * hop - q
    right = (end - 1) * hop - q + n_fft
    source = data[max(0, left) : min(data.shape[-1], right)].to(device=device)
    source = torch.nn.functional.pad(source, (max(0, -left), max(0, right - data.shape[-1])))
    w = _window_tensor(window, win_length, window_param, device)
    transform = torch.stft(
        source,
        n_fft,
        hop_length=hop,
        win_length=win_length,
        window=w,
        center=False,
        return_complex=True,
    )
    return _calibrated_db(transform, w).cpu().numpy()
