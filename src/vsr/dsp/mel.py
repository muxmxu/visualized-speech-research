"""Calibrated mel spectra for the Python API and viewport chunks."""

import numpy as np
import torch

from vsr.dsp.stft import (
    _calibrated_amplitude,
    _centered_transform_chunk,
    _stft_parameters,
    _window_tensor,
    centered_frame_count,
    input_tensor,
)


def mel_filterbank(sr, n_fft, n_mels, fmin, fmax, htk, device):
    from librosa.filters import mel

    weights = mel(sr=sr, n_fft=n_fft, n_mels=n_mels, fmin=fmin, fmax=fmax, htk=htk, norm="slaney")
    return torch.as_tensor(weights, dtype=torch.float32, device=device)


def mel_center_frequencies(n_mels, fmin, fmax, htk):
    from librosa import mel_frequencies

    centers = mel_frequencies(n_mels + 2, fmin=fmin, fmax=fmax, htk=htk)[1:-1]
    return torch.from_numpy(centers.astype(np.float32))


def mel_chunk(data, start, end, n_fft, hop, window, filterbank):
    """Return CPU dB values for absolute frames in [start, end)."""
    transform = _centered_transform_chunk(data, start, end, n_fft, hop, window)
    power = filterbank @ _calibrated_amplitude(transform, window).square()
    return (10 * torch.log10(torch.clamp(power, min=1e-20))).cpu()  # DESIGN §8.3


def mel_db(x, sr, **params) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    n_fft, win_length, hop, window, window_param = _stft_parameters(sr, params)
    n_mels = params.get("n_mels", 128)
    fmin = params.get("fmin", 0.0)
    fmax = params.get("fmax", sr / 2)
    htk = params.get("htk", False)
    x = input_tensor(x)
    w = _window_tensor(window, win_length, window_param, x.device)
    filterbank = mel_filterbank(sr, n_fft, n_mels, fmin, fmax, htk, x.device)
    frames = centered_frame_count(x.shape[-1], n_fft, hop)
    db = mel_chunk(x, 0, frames, n_fft, hop, w, filterbank)
    times = torch.arange(frames, device=x.device, dtype=torch.float32) * hop / sr
    return db, times.cpu(), mel_center_frequencies(n_mels, fmin, fmax, htk)
