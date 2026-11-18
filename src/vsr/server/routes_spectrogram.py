"""Bounded spectrogram cache and absolute-grid viewport reductions."""

import math
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal, localcontext
from fractions import Fraction
from typing import Literal

import numpy as np
from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from pydantic import BaseModel, FiniteFloat, ValidationError

from vsr.api import compute_device
from vsr.dsp.mel import mel_center_frequencies, mel_chunk, mel_filterbank
from vsr.dsp.stft import _window_tensor, centered_frame_count, stft_chunk
from vsr.frame import encode_frame
from vsr.io.tensors import feature_scale


class AudioSpectrogram(BaseModel):
    height: int
    yscale: Literal["linear", "log"]
    channel: int
    mode: Literal["stft", "mel"]
    n_fft: int
    win_length: int
    hop: int
    window: Literal["hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian"]
    window_param: FiniteFloat


class MelSpectrogram(AudioSpectrogram):
    n_mels: int
    fmin: FiniteFloat
    fmax: FiniteFloat
    htk: bool


def build_entry(data, n_fft, win_length, hop, window, window_param, device, budget):
    def read(start, end):
        return stft_chunk(data, start, end, n_fft, win_length, hop, window, window_param, device)

    frames = centered_frame_count(data.shape[-1], n_fft, hop)
    bins = n_fft // 2 + 1
    return build_pyramid(bins, frames, budget, chunk_width(bins), read)


def mel_reader(data, sr, params, device):
    window = _window_tensor(params.window, params.win_length, params.window_param, device)
    filters = mel_filterbank(
        sr, params.n_fft, params.n_mels, params.fmin, params.fmax, params.htk, device
    )

    def read(start, end):
        return mel_chunk(data, start, end, params.n_fft, params.hop, window, filters).numpy()

    return read


def chunk_width(rows):
    return (8 * 2**20) // (2 * rows)


def build_pyramid(bins, frames, budget, chunk, read):
    size = 2 * bins * (frames + (frames + 7) // 8 + (frames + 63) // 64) + 8
    full = size <= budget // 2
    base = np.empty((bins, frames), dtype=np.float16) if full else None
    layers = (
        [np.empty((bins, (frames + p - 1) // p), dtype=np.float16) for p in (8, 64)] if full else []
    )
    maximum = None
    for start in range(0, frames, chunk):
        end = min(frames, start + chunk)
        values = read(start, end)
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


def time_groups(centers, t0, t1, width):
    selected = np.flatnonzero((centers >= t0) & (centers <= t1))
    count = len(selected)
    p = 1 if count <= width else 2 ** math.ceil(math.log2(count / width))
    first = int(selected[0]) // p if count else 0
    last = int(selected[-1]) // p + 1 if count else 0
    return first, last, p


def reduce_group(start, end, cap, read):
    first_end = min(end, start + cap)
    maximum = read(start, first_end).astype(np.float16).max(axis=1)
    for k in range(first_end, end, cap):
        current = read(k, min(end, k + cap)).astype(np.float16).max(axis=1)
        np.maximum(maximum, current, out=maximum)
    return maximum


def pool_audio(entry, bins, first, last, p, reduce_uncached):
    base, p8, p64, _, frames = entry
    pooled = np.empty((bins, last - first), dtype=np.float16)
    layer, stride = (p64, 64) if p >= 64 else ((p8, 8) if p >= 8 else (base, 1))
    for j in range(last - first):
        start, end = (first + j) * p, min((first + j + 1) * p, frames)
        if base is None:
            pooled[:, j] = reduce_uncached(start, end)
        else:
            pooled[:, j] = layer[:, start // stride : (end + stride - 1) // stride].max(axis=1)
    return pooled


def first_group_center(first, p, frames):
    start = first * p
    end = min(start + p, frames)
    return (start + end - 1) / 2


def spectral_response(result, col_t0, col_dt, row_freqs, f_axis, lane_max):
    rows, cols = result.shape
    meta = {
        "col_t0": col_t0,
        "col_dt": col_dt,
        "cols": cols,
        "rows": rows,
        "row_freqs": row_freqs,
        "f_axis": f_axis,
        "view_db_max": float(result.max()) if result.size else None,
        "lane_db_max": lane_max,
    }
    return Response(
        encode_frame(result, meta),
        media_type="application/octet-stream",
        headers={"Cache-Control": "no-store"},
    )


def feature_view(data, rate, origin, axis, scale, t0, t1, width, f_lo, f_hi):
    if f_lo < 0 or f_hi < f_lo or not f_lo.is_integer() or not f_hi.is_integer():
        raise HTTPException(422, "Feature frequency limits must be nonnegative integer row indices")
    rows, frames = data.shape
    first_row, end_row = min(int(f_lo), rows), min(int(f_hi) + 1, rows)
    selection = data[first_row:end_row]
    centers = origin + np.arange(frames, dtype=np.float64) / rate
    first, last, p = time_groups(centers, t0, t1, width)
    pooled = np.empty((len(selection), last - first), dtype=np.float32)
    for j, group in enumerate(range(first, last)):
        pooled[:, j] = selection[:, group * p : (group + 1) * p].max(axis=1)
    row_indices = np.arange(first_row, end_row)
    match axis["type"]:
        case "linear":
            labels = row_indices / max(1, rows - 1) * axis["f_max"]
        case "mel":
            labels = mel_center_frequencies(rows, axis["fmin"], axis["fmax"], axis["htk"]).numpy()[
                first_row:end_row
            ]
        case "index":
            labels = row_indices
    result = pooled if scale == "raw" else feature_scale(pooled, scale).astype(np.float16)
    return spectral_response(
        result,
        origin + first_group_center(first, p, frames) / rate,
        p / rate,
        labels.tolist(),
        {"scale": axis["type"], "lo": int(f_lo), "hi": int(f_hi)},
        float(feature_scale(data.max(), scale)),
    )


def register_spectrogram(app, session, find, heavy, budget):
    @app.get("/api/lanes/{lane_id}/spectrogram")
    def spectrogram(
        request: Request,
        lane_id: str,
        t0: FiniteFloat,
        t1: FiniteFloat,
        width: int,
        f_lo: FiniteFloat,
        f_hi: FiniteFloat,
    ):
        if t1 <= t0 or width <= 0:
            raise HTTPException(422, "Invalid spectrogram parameters")
        with session.lock:
            lane = find(lane_id)
            kind = lane.kind
            if kind not in {"audio", "feature"}:
                raise HTTPException(422, "Spectrogram requires an audio or feature lane")
            data, sr, offset, version = lane.data, lane.sr, lane.offset, lane.version
            rate, frame_t0, axis, scale = (
                lane.frame_rate,
                lane.frame_t0,
                lane.freq_axis,
                lane.value_scale,
            )
        if kind == "feature":
            return feature_view(
                data.numpy(), rate, offset + frame_t0, axis, scale, t0, t1, width, f_lo, f_hi
            )

        raw = dict(request.query_params)
        is_mel = raw.get("mode") == "mel"
        try:
            params = (MelSpectrogram if is_mel else AudioSpectrogram).model_validate(raw)
        except ValidationError as exc:
            errors = [
                error | {"loc": ("query", *error["loc"])} for error in exc.errors(include_url=False)
            ]
            raise RequestValidationError(errors) from exc
        n_fft, win_length, hop = params.n_fft, params.win_length, params.hop
        window, window_param = params.window, params.window_param
        yscale, height, channel = params.yscale, params.height, params.channel
        bins = params.n_mels if is_mel else n_fft // 2 + 1
        if (
            height <= 0
            or f_hi <= f_lo
            or f_lo < 0
            or n_fft <= 0
            or win_length <= 0
            or win_length > n_fft
            or hop <= 0
            or channel < 0
            or (window == "gaussian" and window_param <= 0)
            or bins <= 0
            or chunk_width(max(bins, n_fft // 2 + 1)) == 0
        ):
            raise HTTPException(422, "Invalid spectrogram parameters")
        if channel >= data.shape[0]:
            raise HTTPException(422, "Invalid channel")
        data = data[channel]
        if f_hi > sr / 2 or (not is_mel and yscale == "log" and f_lo < max(20.0, sr / n_fft)):
            raise HTTPException(422, "Invalid frequency range")
        if is_mel and not 0 <= params.fmin < params.fmax <= sr / 2:
            raise HTTPException(422, "Invalid mel frequency limits")
        key = (lane_id, version, channel, params.mode, n_fft, win_length, hop, window, window_param)
        if is_mel:
            key += (params.n_mels, params.fmin, params.fmax, params.htk)

        cap = chunk_width(max(bins, n_fft // 2 + 1))

        def build(device):
            with heavy:
                if is_mel:
                    frames = centered_frame_count(data.shape[-1], n_fft, hop)
                    return build_pyramid(
                        bins, frames, budget, cap, mel_reader(data, sr, params, device)
                    )
                return build_entry(
                    data, n_fft, win_length, hop, window, window_param, device, budget
                )

        entry, device = cached_entry(session, key, build, budget)
        base, _, _, lane_max, frames = entry
        centers = np.arange(frames, dtype=np.float64) * hop / sr + offset
        first, last, p = time_groups(centers, t0, t1, width)
        cols = last - first

        def read_stft(start, end):
            return stft_chunk(
                data, start, end, n_fft, win_length, hop, window, window_param, device
            )

        def reduce_stft(start, end):
            with heavy:
                return reduce_group(start, end, cap, read_stft)

        if is_mel and base is None and cols:
            with heavy:
                read = mel_reader(data, sr, params, device)

                def reduce_mel(start, end):
                    return reduce_group(start, end, cap, read)

                pooled = pool_audio(entry, bins, first, last, p, reduce_mel)
        else:
            pooled = pool_audio(entry, bins, first, last, p, reduce_stft)

        col_dt = p * hop / sr
        if is_mel:
            center = first_group_center(first, p, frames) if cols else 0
            freqs = mel_center_frequencies(bins, params.fmin, params.fmax, params.htk).numpy()
            indices = (freqs >= f_lo) & (freqs <= f_hi)
            return spectral_response(
                pooled[indices],
                offset + center * hop / sr,
                col_dt,
                freqs[indices].tolist(),
                {"scale": "mel", "lo": f_lo, "hi": f_hi},
                lane_max,
            )
        col_t0 = offset + (first * p + (p - 1) / 2) * hop / sr
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
        return spectral_response(
            result, col_t0, col_dt, row_freqs, {"scale": yscale, "lo": lo, "hi": hi}, lane_max
        )
