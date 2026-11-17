"""Waveform viewport aggregation."""

import math

import numpy as np


def waveform(
    data: np.ndarray, sr: int, t0: float, t1: float, width: int
) -> tuple[np.ndarray, dict]:
    spp = (t1 - t0) * sr / width
    start = t0 * sr
    if spp <= 1:
        first = max(0, min(data.shape[1], round(start)))
        last = max(first, min(data.shape[1], round(t1 * sr)))
        return data[:, first:last], {"first_sample": first, "t0": first / sr, "t1": last / sr}
    columns = []
    indices = []
    for j in range(width):
        a = max(0, math.floor(start + j * spp))
        b = min(data.shape[1], math.floor(start + (j + 1) * spp))
        if a < b:
            segment = data[:, a:b]
            columns.append(
                np.stack(
                    (
                        segment.min(axis=1),
                        segment.max(axis=1),
                        np.sqrt(np.mean(segment**2, axis=1)),
                    ),
                    axis=1,
                )
            )
            indices.append(j)
    if not columns:
        return np.empty((data.shape[0], 3, 0), dtype=np.float32), {
            "t0": 0,
            "t1": 0,
            "column_start": 0,
        }
    first, last = indices[0], indices[-1]
    return np.stack(columns, axis=2), {
        "t0": max(0, (start + first * spp) / sr),
        "t1": min(data.shape[1] / sr, (start + (last + 1) * spp) / sr),
        "column_start": first,
    }
