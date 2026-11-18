"""Sample edits and time-frequency selection synthesis."""

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


def _masked_synthesis(
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
    gain,
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
    if gain is not None:
        mask = 1 + (gain - 1) * mask
    reconstructed = torch.istft(
        transform * mask,
        n_fft,
        hop_length=hop,
        win_length=win_length,
        window=w,
        center=True,
        length=end - k0 * hop,
    )
    return reconstructed[:, start - k0 * hop :]


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
    return (
        _masked_synthesis(
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
            None,
        )
        .cpu()
        .numpy()
    )


def attenuate_interval(data, start, end, sr, device, gain, **mask):
    n_fft = mask["n_fft"]
    total = data.shape[-1]
    left, right = start - n_fft, end + n_fft
    first, last = max(0, left), min(total, right)
    edited = _masked_synthesis(data, total, 0, first, last, sr, device=device, gain=gain, **mask)
    head, tail = start - first, end - first
    rise = torch.arange(first - left, n_fft, device=device, dtype=torch.float32) / n_fft
    fall = torch.arange(n_fft - 1, right - last - 1, -1, device=device, dtype=torch.float32)
    edited[:, :head] = torch.lerp(data[:, first:start].to(device), edited[:, :head], rise)
    edited[:, tail:] = torch.lerp(data[:, end:last].to(device), edited[:, tail:], fall / n_fft)
    return first, last, edited.cpu()


def edit_samples(data, start, end, channel, op, device, *, gain_db, target_dbfs, curve):
    x = data.to(device)
    if op in {"cut", "delete"}:
        return torch.cat((x[:, :start], x[:, end:]), dim=1).cpu()
    if op == "trim":
        return x[:, start:end].clone().cpu()
    if op == "mixdown_channels":
        return x.mean(dim=0, keepdim=True).cpu()

    channels = slice(None) if channel is None else slice(channel, channel + 1)
    segment = x[channels, start:end]
    match op:
        case "silence":
            edited = torch.zeros_like(segment)
        case "invert":
            edited = -segment
        case "gain":
            edited = segment * (10 ** (gain_db / 20))
        case "normalize":
            peak = segment.abs().amax()
            factor = torch.where(peak == 0, 1.0, 10 ** (target_dbfs / 20) / peak)
            edited = segment * factor
        case "fade_in" | "fade_out":
            endpoints = (0, 1) if op == "fade_in" else (1, 0)
            ramp = torch.linspace(*endpoints, end - start, device=device, dtype=torch.float32)
            if curve == "equal-power":
                ramp = torch.sin(ramp * (torch.pi / 2))
            edited = segment * ramp

    result = data.clone()
    result[channels, start:end] = edited.cpu()
    return result


def insert_samples(data, start, channel, device, *, clip=None, frames=0):
    x = data.to(device)
    if clip is None:
        inserted = x.new_zeros((x.shape[0], frames))
    else:
        clip = clip.to(device)
        count = x.shape[0] if channel is None else 1
        if count == 1 and clip.shape[0] != 1:
            clip = clip.mean(dim=0, keepdim=True)
        if channel is None:
            inserted = clip.expand(count, -1)
        else:
            inserted = x.new_zeros((x.shape[0], clip.shape[1]))
            inserted[channel] = clip[0]
    return torch.cat((x[:, :start], inserted, x[:, start:]), dim=1).cpu()
