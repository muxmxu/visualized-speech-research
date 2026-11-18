"""Frequency analysis and energy-based activity."""

import math

import torch
import torch.nn.functional as F

from vsr.api import compute_device
from vsr.dsp.stft import input_tensor, window_tensor
from vsr.presets import resolve_preset


class NoEligibleFrames(ValueError):
    """No complete analysis frames satisfy the activity criterion."""


def activity_geometry(sr):
    return round(0.02 * sr), round(0.01 * sr)


def frame_rms(x, sr):
    x = input_tensor(x).mean(dim=0)
    win, hop = activity_geometry(sr)
    if x.numel() < win:
        empty = x.new_empty(0)
        return empty, empty
    frames = x.unfold(0, win, hop)
    rms = frames.square().mean(dim=-1).sqrt()
    times = (
        torch.arange(len(rms), dtype=torch.float32, device=compute_device()) * hop + win / 2
    ) / sr
    return times, rms


def active_frames(x, sr):
    times, rms = frame_rms(x, sr)
    if rms.numel() == 0:
        return times.cpu(), rms.new_empty(0, dtype=torch.bool).cpu()
    return times.cpu(), ((rms > rms.max() * 0.01) & (rms > 10 ** (-70 / 20))).cpu()


def spectrum(
    x,
    sr,
    *,
    method="welch",
    t0=0.0,
    t1=None,
    stats=("mean",),
    unit="dbfs",
    active_only=False,
    n_fft=None,
    win_length=None,
    hop=None,
    window=None,
    window_param=None,
):
    x = input_tensor(x)
    defaults = resolve_preset("analysis", sr)
    n_fft = n_fft or defaults["n_fft"]
    win_length = win_length or n_fft
    hop = hop or win_length // 4
    start = max(0, round(t0 * sr))
    end = x.shape[-1] if t1 is None else min(x.shape[-1], round(t1 * sr))
    if method == "full":
        segment = x[:, start:end]
        if segment.shape[-1] > 2**24:
            raise ValueError("Full spectrum interval exceeds 2^24 samples")
        size = 2 ** math.ceil(math.log2(segment.shape[-1]))
        w = window_tensor(window or "boxcar", segment.shape[-1], window_param)
        magnitude = torch.fft.rfft(segment * w, n=size).abs()
        values = 20 * torch.log10(torch.clamp(magnitude, min=1e-10))  # DESIGN §8.4
        return values[:, None, :].cpu(), torch.fft.rfftfreq(
            size, 1 / sr, device=compute_device(), dtype=torch.float32
        ).cpu()
    if window not in {None, "hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian"}:
        raise ValueError("Invalid analysis window")
    w = window_tensor(window or "hann", win_length, window_param)
    if method == "frame":
        left = round(t0 * sr) - win_length // 2
        right = left + win_length
        frames = F.pad(
            x[:, max(0, left) : min(x.shape[-1], right)],
            (max(0, -left), max(0, right - x.shape[-1])),
        )[:, None, :]
    else:
        frames = x[:, start:end].unfold(-1, win_length, hop)
        if active_only:
            times, active = active_frames(x, sr)
            if not active.any():
                raise NoEligibleFrames("No eligible activity frames")
            active = active.to(compute_device())
            activity_win, activity_hop = activity_geometry(sr)
            activity_centers = (
                torch.arange(len(times), device=compute_device()) * (2 * activity_hop)
                + activity_win
            )
            centers = (
                torch.arange(frames.shape[1], device=compute_device()) * hop + start
            ) * 2 + win_length
            indices = torch.minimum(
                torch.searchsorted(activity_centers, centers),
                torch.tensor(len(times) - 1, device=compute_device()),
            )
            previous = torch.maximum(indices - 1, torch.tensor(0, device=compute_device()))
            keep = ((centers - activity_centers[indices]).abs() * 100 <= sr) & active[indices]
            keep |= ((centers - activity_centers[previous]).abs() * 100 <= sr) & active[previous]
            frames = frames[:, keep, :]
            if frames.shape[1] == 0:
                raise NoEligibleFrames("No eligible activity frames")
    amplitude = torch.fft.rfft(frames * w, n=n_fft).abs() * (2 / w.sum())
    power = amplitude.square()
    if method == "frame":
        stats, unit = ("mean",), "dbfs"
    if unit == "db_per_hz":
        power = power * (w.sum().square() / (2 * sr * w.square().sum()))
        db = 10 * torch.log10(power)
    else:
        db = 10 * torch.log10(torch.clamp(power, min=1e-20))  # DESIGN §8.1
    result = []
    for stat in stats:
        if stat == "mean":
            mean_power = power.mean(dim=1)
            if unit == "dbfs":
                mean_power = torch.clamp(mean_power, min=1e-20)  # DESIGN §8.1 and §8.4
            value = 10 * torch.log10(mean_power)
        elif stat == "max":
            value = db.max(dim=1).values
        else:
            quantile = {"p10": 0.1, "median": 0.5, "p90": 0.9}[stat]
            if unit == "db_per_hz":
                ordered = db.sort(dim=1).values
                rank = quantile * (ordered.shape[1] - 1)
                lower_index = math.floor(rank)
                fraction = rank - lower_index
                lower = ordered[:, lower_index, :]
                if fraction == 0:
                    value = lower
                else:
                    upper = ordered[:, lower_index + 1, :]
                    value = lower.clone()
                    finite = ~torch.isneginf(lower)
                    value[finite] = torch.lerp(lower[finite], upper[finite], fraction)
            else:
                value = torch.quantile(db, quantile, dim=1)
        result.append(value)
    return torch.stack(result, dim=1).cpu(), torch.fft.rfftfreq(
        n_fft, 1 / sr, device=compute_device(), dtype=torch.float32
    ).cpu()


def welch(x, sr, stats=("mean",), unit="dbfs", **params) -> tuple[torch.Tensor, torch.Tensor]:
    if "method" in params:
        raise ValueError("welch does not accept method")
    return spectrum(x, sr, stats=stats, unit=unit, **params)
