"""Time-frequency selection weights and bounded masked synthesis."""

import numpy as np
import torch
import torch.nn.functional as functional

from vsr.dsp.stft import _window_tensor


def _axis_weight(start, count, numerator, denominator, lower, upper):
    # Evaluate absolute coordinates in float64 before casting the final 2-D mask.
    # This matches the whole-lane grid across chunks and avoids device float64.
    indices = np.arange(start, start + count, dtype=np.float64)
    coordinates = indices * numerator / denominator
    step = numerator / denominator
    distance = np.zeros(count, dtype=np.float64)
    if lower > coordinates[0]:
        distance = np.maximum(distance, lower - coordinates)
    if upper < coordinates[-1]:
        distance = np.maximum(distance, coordinates - upper)
    weight = np.zeros(count, dtype=np.float64)
    weight[distance == 0] = 1
    transition = (distance > 0) & (distance < 2 * step)
    weight[transition] = (1 + np.cos(np.pi * distance[transition] / (2 * step))) / 2
    return weight


def spectral_mask(k0, frames, bins, sr, hop, n_fft, t0, t1, f_lo, f_hi, device):
    """Return the §15 rectangle membership on absolute frame and bin grids."""
    time = _axis_weight(k0, frames, hop, sr, t0, t1)
    frequency = _axis_weight(0, bins, sr, n_fft, f_lo, f_hi)
    weights = (frequency[:, None] * time[None, :]).astype(np.float32)
    return torch.as_tensor(weights, device=device)


def masked_interval(
    data,
    total,
    source_offset,
    start,
    end,
    sr,
    n_fft,
    win_length,
    window,
    window_param,
    t0,
    t1,
    f_lo,
    f_hi,
    device,
):
    hop = win_length // 4
    q = n_fft // 2
    frames = 1 + (total + 2 * q - n_fft) // hop
    k0 = max(0, (start + q - n_fft) // hop + 1)
    k1 = min(frames, (end - 1 + q) // hop + 1)
    left = k0 * hop - q
    right = (k1 - 1) * hop - q + n_fft
    x = data[:, max(0, left) - source_offset : min(total, right) - source_offset].to(device)
    x = functional.pad(x, (max(0, -left), max(0, right - total)))
    w = _window_tensor(window, win_length, window_param, device)
    transform = torch.stft(
        x, n_fft, hop_length=hop, win_length=win_length, window=w, center=False, return_complex=True
    )
    mask = spectral_mask(k0, k1 - k0, n_fft // 2 + 1, sr, hop, n_fft, t0, t1, f_lo, f_hi, device)
    reconstructed = torch.istft(
        transform * mask,
        n_fft,
        hop_length=hop,
        win_length=win_length,
        window=w,
        center=True,
        length=end - k0 * hop,
    )
    return reconstructed[:, start - k0 * hop :].cpu().numpy()
