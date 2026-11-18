"""Mix session audio on the target sample grid."""

from math import gcd

import numpy as np
from scipy.signal import resample_poly

from vsr.server.session import Lane


def mix_audio(
    lanes: list[Lane], first: int, last: int | None, sr: int, excluded: frozenset[str] = frozenset()
) -> np.ndarray:
    solo = any(lane.solo for lane in lanes)
    audible = [
        lane
        for lane in lanes
        if lane.id not in excluded and not lane.mute and (not solo or lane.solo)
    ]
    width = max((lane.data.shape[0] for lane in audible), default=1)
    offsets = [round(lane.offset * sr) for lane in audible]
    if last is None:
        last = max(
            [first]
            + [
                offset + (lane.data.shape[1] * sr + lane.sr - 1) // lane.sr
                for lane, offset in zip(audible, offsets, strict=True)
            ]
        )
    mixed = np.zeros((width, last - first), dtype=np.float32)
    for lane, offset in zip(audible, offsets, strict=True):
        data = lane.data.numpy()
        start = max(first, offset)
        length = (data.shape[1] * sr + lane.sr - 1) // lane.sr
        end = min(last, offset + length)
        if start >= end:
            continue
        if lane.sr != sr:
            divisor = gcd(sr, lane.sr)
            data = resample_poly(data, sr // divisor, lane.sr // divisor, axis=1)
        clip = data[:, start - offset : end - offset] * 10 ** (lane.gain_db / 20)
        channels = width if width == 2 and clip.shape[0] == 1 else clip.shape[0]
        mixed[:channels, start - first : end - first] += clip
    return mixed


def playback_output(mixed: np.ndarray, channels: int) -> np.ndarray:
    if channels == 1:
        return mixed[:2].mean(axis=0, dtype=np.float32)[:, None]
    if mixed.shape[0] == 1:
        return np.repeat(mixed.T, 2, axis=1)
    return mixed[:2].T
