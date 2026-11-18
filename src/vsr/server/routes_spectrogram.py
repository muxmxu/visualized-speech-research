"""Bounded spectrogram cache and absolute-grid viewport reductions."""

import math
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, localcontext
from fractions import Fraction
from typing import Literal

import numpy as np
from fastapi import HTTPException
from fastapi.responses import Response
from pydantic import FiniteFloat

from vsr.api import compute_device
from vsr.dsp.stft import stft_chunk
from vsr.frame import encode_frame


def build_entry(data, n_fft, win_length, hop, window, window_param, device, budget):
    bins = n_fft // 2 + 1
    frames = 1 + (data.shape[-1] + 2 * (n_fft // 2) - n_fft) // hop
    chunk = (8 * 2**20) // (2 * bins)
    size = 2 * bins * (frames + (frames + 7) // 8 + (frames + 63) // 64) + 8
    full = size <= budget // 2
    base = np.empty((bins, frames), dtype=np.float16) if full else None
    layers = (
        [np.empty((bins, (frames + p - 1) // p), dtype=np.float16) for p in (8, 64)] if full else []
    )
    maximum = None
    for start in range(0, frames, chunk):
        end = min(frames, start + chunk)
        values = stft_chunk(data, start, end, n_fft, win_length, hop, window, window_param, device)
        chunk_max = float(values.max())
        maximum = chunk_max if maximum is None else max(maximum, chunk_max)
        if full:
            base[:, start:end] = values
            block = base[:, start:end]
            for p, layer in zip((8, 64), layers, strict=True):
                pos = 0
                if start % p:
                    length = min(p - start % p, end - start)
                    layer[:, start // p] = np.maximum(
                        layer[:, start // p], block[:, :length].max(axis=1)
                    )
                    pos = length
                complete = (end - start - pos) // p
                if complete:
                    group_start = (start + pos) // p
                    layer[:, group_start : group_start + complete] = (
                        block[:, pos : pos + complete * p].reshape(bins, complete, p).max(axis=2)
                    )
                    pos += complete * p
                if pos < end - start:
                    layer[:, (start + pos) // p] = block[:, pos:].max(axis=1)
    return (base, *layers, maximum, frames) if full else (None, None, None, maximum, frames)


def cached_entry(session, key, build, budget):
    with session.cache_lock:
        device = compute_device()
        if key in session.cache:
            session.cache.move_to_end(key)
            return session.cache[key], device
        generation = session.cache_generation
        flight_key = (generation, key)
        future = session.inflight.get(flight_key)
        owner = future is None
        if owner:
            executor = ThreadPoolExecutor(max_workers=1)
            future = executor.submit(build, device)
            session.inflight[flight_key] = future
    if not owner:
        return future.result(), device
    try:
        entry = future.result()
        size = sum(a.nbytes for a in entry[:3] if a is not None) + 8
        with session.cache_lock:
            if generation == session.cache_generation and size <= budget:
                while session.cache_size + size > budget:
                    _, old = session.cache.popitem(last=False)
                    session.cache_size -= sum(a.nbytes for a in old[:3] if a is not None) + 8
                session.cache[key] = entry
                session.cache_size += size
        return entry, device
    finally:
        with session.cache_lock:
            del session.inflight[flight_key]
        executor.shutdown(wait=True)


def log_bin_boundary(freqs, lower, upper, numerator, denominator):
    """Find the first bin on or above a geometric boundary without rounding it."""
    threshold = lower ** (denominator - numerator) * upper**numerator
    start, end = 0, len(freqs)
    while start < end:
        middle = (start + end) // 2
        value = Fraction.from_float(float(freqs[middle])) ** denominator
        if value < threshold:
            start = middle + 1
        else:
            end = middle
    return start


def register_spectrogram(app, session, find, heavy, budget):
    @app.get("/api/lanes/{lane_id}/spectrogram")
    def spectrogram(
        lane_id: str,
        t0: FiniteFloat,
        t1: FiniteFloat,
        width: int,
        height: int,
        f_lo: FiniteFloat,
        f_hi: FiniteFloat,
        yscale: Literal["linear", "log"],
        channel: int,
        mode: Literal["stft"],
        n_fft: int,
        win_length: int,
        hop: int,
        window: Literal["hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian"],
        window_param: FiniteFloat,
    ):
        if (
            t1 <= t0
            or width <= 0
            or height <= 0
            or f_hi <= f_lo
            or f_lo < 0
            or n_fft <= 0
            or win_length <= 0
            or win_length > n_fft
            or hop <= 0
            or channel < 0
            or (window == "gaussian" and window_param <= 0)
            or 2 * (n_fft // 2 + 1) > 8 * 2**20
        ):
            raise HTTPException(422, "Invalid spectrogram parameters")
        with session.lock:
            lane = find(lane_id)
            if channel >= lane.data.shape[0]:
                raise HTTPException(422, "Invalid channel")
            data, sr, offset, version = lane.data[channel], lane.sr, lane.offset, lane.version
        if f_hi > sr / 2 or (yscale == "log" and f_lo < max(20.0, sr / n_fft)):
            raise HTTPException(422, "Invalid frequency range")
        key = (lane_id, version, channel, mode, n_fft, win_length, hop, window, window_param)

        def build(device):
            with heavy:
                return build_entry(
                    data, n_fft, win_length, hop, window, window_param, device, budget
                )

        entry, device = cached_entry(session, key, build, budget)
        base, p8, p64, lane_max, frames = entry
        centers = np.arange(frames, dtype=np.float64) * hop / sr + offset
        selected = np.flatnonzero((centers >= t0) & (centers <= t1))
        count = len(selected)
        p = 1 if count <= width else 2 ** math.ceil(math.log2(count / width))
        first = int(selected[0]) // p if count else 0
        last = int(selected[-1]) // p + 1 if count else 0
        cols = last - first
        bins = n_fft // 2 + 1
        pooled = np.empty((bins, cols), dtype=np.float16)
        layer, stride = (p64, 64) if p >= 64 else ((p8, 8) if p >= 8 else (base, 1))
        for j in range(cols):
            start, end = (first + j) * p, min((first + j + 1) * p, frames)
            if base is None:
                maximum = None
                cap = (8 * 2**20) // (2 * bins)
                with heavy:
                    for k in range(start, end, cap):
                        part = stft_chunk(
                            data,
                            k,
                            min(end, k + cap),
                            n_fft,
                            win_length,
                            hop,
                            window,
                            window_param,
                            device,
                        ).astype(np.float16)
                        current = part.max(axis=1)
                        if maximum is None:
                            maximum = current
                        else:
                            np.maximum(maximum, current, out=maximum)
                pooled[:, j] = maximum
            else:
                pooled[:, j] = layer[:, start // stride : (end + stride - 1) // stride].max(axis=1)
        freqs = np.arange(bins, dtype=np.float64) * sr / n_fft
        if yscale == "linear":
            indices = np.flatnonzero((freqs >= f_lo) & (freqs <= f_hi))
            group = max(1, math.ceil(len(indices) / height))
            rows = [
                pooled[indices[i : i + group]].max(axis=0) for i in range(0, len(indices), group)
            ]
            row_freqs = [
                float(freqs[indices[i : i + group]].mean()) for i in range(0, len(indices), group)
            ]
            if len(indices):
                lo = max(0.0, float(freqs[indices[0]]) - sr / (2 * n_fft))
                hi = min(sr / 2, float(freqs[indices[-1]]) + sr / (2 * n_fft))
            else:
                lo, hi = f_lo, f_hi
        else:
            lo, hi = f_lo, f_hi
            lower, upper = Fraction.from_float(lo), Fraction.from_float(hi)
            edge_bins = [int(np.searchsorted(freqs, lo))]
            edge_bins.extend(
                log_bin_boundary(freqs, lower, upper, i, height) for i in range(1, height)
            )
            edge_bins.append(int(np.searchsorted(freqs, hi)))
            with localcontext() as ctx:
                ctx.prec = 50
                low_decimal = Decimal.from_float(lo)
                high_decimal = Decimal.from_float(hi)
                edges_decimal = [
                    low_decimal * (high_decimal / low_decimal) ** (Decimal(i) / height)
                    for i in range(height + 1)
                ]
                row_freqs = [
                    float((a * b).sqrt())
                    for a, b in zip(edges_decimal[:-1], edges_decimal[1:], strict=True)
                ]
            rows = []
            for i, (start_bin, end_bin, center) in enumerate(
                zip(edge_bins[:-1], edge_bins[1:], row_freqs, strict=True)
            ):
                if start_bin < end_bin:
                    rows.append(pooled[start_bin:end_bin].max(axis=0))
                else:
                    idx = log_bin_boundary(freqs, lower, upper, 2 * i + 1, 2 * height)
                    if idx == 0 or idx == bins:
                        raise HTTPException(422, "Log band center outside frequency bins")
                    weight = (center - freqs[idx - 1]) / (freqs[idx] - freqs[idx - 1])
                    rows.append(
                        pooled[idx - 1].astype(np.float32) * (1 - weight)
                        + pooled[idx].astype(np.float32) * weight
                    )
        result = np.asarray(rows, dtype=np.float16).reshape(len(rows), cols)
        meta = {
            "col_t0": offset + (first * p + (p - 1) / 2) * hop / sr,
            "col_dt": p * hop / sr,
            "cols": cols,
            "rows": len(rows),
            "row_freqs": row_freqs,
            "f_axis": {"scale": yscale, "lo": lo, "hi": hi},
            "view_db_max": float(result.max()) if result.size else None,
            "lane_db_max": lane_max,
        }
        return Response(
            encode_frame(result, meta),
            media_type="application/octet-stream",
            headers={"Cache-Control": "no-store"},
        )
