"""Exponential sine sweeps and regularized deconvolution (§14.2)."""

from math import log, pi

import numpy as np
import torch
from torch.nn.functional import pad

from vsr.api import compute_device


def exponential_sweep(
    sr: int,
    f1: float,
    f2: float,
    duration: float,
    amplitude_dbfs: float,
    fade_in: int,
    fade_out: int,
    pre_silence: int,
    tail_silence: int,
) -> np.ndarray:
    rate = log(f2 / f1) / duration
    times = np.arange(round(sr * duration), dtype=np.float64) / sr
    sweep = (
        10 ** (amplitude_dbfs / 20) * np.sin(2 * pi * f1 / rate * np.expm1(rate * times))
    ).astype(np.float32)
    sweep[:fade_in] *= np.linspace(0, 1, fade_in, dtype=np.float32)
    sweep[len(sweep) - fade_out :] *= np.linspace(1, 0, fade_out, dtype=np.float32)
    return np.pad(sweep, (pre_silence, tail_silence))


def deconvolve(
    sweep: np.ndarray,
    captured: torch.Tensor,
    sr: int,
    f1: float,
    f2: float,
    length: int,
    loopback_index: int | None,
) -> tuple[torch.Tensor, int | None]:
    device = compute_device()
    frames = captured.shape[-1]
    x = torch.fft.rfft(torch.from_numpy(sweep).to(device), n=frames)
    power = x.abs().square()
    frequencies = torch.fft.rfftfreq(frames, d=1 / sr, device=device, dtype=torch.float32)
    regularizer = torch.where((frequencies >= f1) & (frequencies <= f2), 1e-6, 1e2) * power.max()
    y = torch.fft.rfft(captured.to(device), n=frames)
    responses = torch.fft.irfft(y * x.conj() / (power + regularizer), n=frames)
    # DESIGN §14.2: discard wrapped negative lags before locating the loopback peak.
    responses = responses[:, : (frames + 1) // 2]
    delay = None
    if loopback_index is not None:
        delay = int(responses[loopback_index].abs().argmax().item())
        responses = torch.cat((responses[:loopback_index], responses[loopback_index + 1 :]))
    start = 0 if delay is None else delay
    retained = responses[:, start : start + length]
    return pad(retained, (0, length - retained.shape[-1])).cpu(), delay
