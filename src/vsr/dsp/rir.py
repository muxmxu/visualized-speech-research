"""Room impulse response metrics and decay curves."""

from dataclasses import dataclass
from math import isfinite, log, log10, sqrt
from numbers import Integral

import numpy as np
import torch
from scipy.signal import butter, sosfilt

from vsr.dsp.stft import input_tensor

_OCTAVE_CENTERS = (125, 250, 500, 1000, 2000, 4000, 8000)
_FIT_RANGES = {"EDT": (0, -10), "T20": (-5, -25), "T30": (-5, -35)}


def octave_bands(sr):
    return tuple(center for center in _OCTAVE_CENTERS if center * sqrt(2) < 0.95 * sr / 2)


def onset_sample(power):
    peak = power.max()
    return int(np.flatnonzero(power >= peak / 100)[0]) if peak > 0 else None


def mean_blocks(power, start, width, sr):
    starts = np.arange(start, len(power), width)
    stops = np.r_[starts[1:], len(power)]
    counts = stops - starts
    centers = (starts + (counts - 1) / 2) / sr
    return centers, np.add.reduceat(power, starts) / counts


def line_fit(times, values):
    x = times - times.mean()
    y = values - values.mean()
    slope = float(np.dot(x, y) / np.dot(x, x))
    return slope, float(values.mean() - slope * times.mean())


@dataclass(frozen=True)
class NoiseIntersection:
    time: float
    slope: float
    intercept: float
    noise_power: float
    floor_db: float

    def tail(self, sample, sr):
        power = 10 ** ((self.slope * sample / sr + self.intercept) / 10)
        return sr * power * (-10 / (log(10) * self.slope))


def lundeby(power, onset, sr):
    count = len(power)
    noise = float(power[-max(1, round(0.1 * count)) :].mean())
    if noise == 0:
        return None
    width = max(1, round(0.030 * sr))
    times, means = mean_blocks(power, onset, width, sr)
    peak = float(means.max())
    for iteration in range(5):
        first = int(means.argmax())
        below_margin = np.flatnonzero(means[first:] <= 10 * noise)
        last = first + below_margin[0] if below_margin.size else len(means)
        if last - first < 2:
            return None
        slope, intercept = line_fit(times[first:last], 10 * np.log10(means[first:last]))
        if slope >= 0:
            return None
        crossing = (10 * log10(noise) - intercept) / slope
        # Estimate stationary noise after the model has decayed another 10 dB.
        noise_start = round((crossing - 10 / slope) * sr)
        if crossing <= times[last - 1] or noise_start >= count:
            return None
        refined = float(power[noise_start:].mean())
        if refined == 0:
            return None
        if (iteration > 0 and abs(refined - noise) <= 0.01 * noise) or iteration == 4:
            crossing = (10 * log10(refined) - intercept) / slope
            if not times[last - 1] < crossing < count / sr:
                return None
            return NoiseIntersection(
                crossing, slope, intercept, refined, 10 * log10(refined / peak)
            )
        noise = refined
        width = max(1, round(-2 * sr / slope))
        times, means = mean_blocks(power, onset, width, sr)


def window_energy(h, start, stop, sos):
    if start >= stop:
        return 0.0
    section = h[start:stop]
    if sos is not None:
        # Gate first and include the filter's ring-down within the signal length.
        section = sosfilt(sos, np.pad(section, (0, len(h) - len(section))))
    return float(np.dot(section, section))


def energy_metrics(h, sr, onset, peak, cutoff, sos, tail):
    metrics, reasons = {}, {}

    def ratio(name, numerator, denominator, missing_numerator, missing_denominator):
        if denominator <= 0:
            metrics[name] = None
            reasons[name] = missing_denominator
        elif numerator <= 0 and name != "D50":
            metrics[name] = None
            reasons[name] = missing_numerator
        elif name == "D50":
            metrics[name] = numerator / denominator
        else:
            metrics[name] = 10 * (log10(numerator) - log10(denominator))

    start = cutoff if onset is None else min(onset, cutoff)
    for ms in (50, 80):
        boundary = min(cutoff, start + round(ms * sr / 1000))
        early = window_energy(h, start, boundary, sos)
        late = window_energy(h, boundary, cutoff, sos) + tail
        ratio(f"C{ms}", early, late, f"No early energy in {ms} ms", f"No late energy after {ms} ms")
        if ms == 50:
            total = window_energy(h, start, cutoff, sos)
            ratio("D50", early, total, "", "No energy between onset and cutoff")

    width = round(0.0025 * sr)
    direct_start = min(cutoff, max(0, peak - width))
    direct_stop = min(cutoff, peak + width)
    direct = window_energy(h, direct_start, direct_stop, sos)
    rest = window_energy(h, 0, direct_start, sos) + window_energy(h, direct_stop, cutoff, sos)
    ratio("DRR", direct, rest, "No direct-window energy", "No energy outside the direct window")
    return metrics, reasons


def db_levels(power, reference):
    values = np.full(power.shape, np.nan)
    if reference > 0:
        positive = power > 0
        values[positive] = 10 * np.log10(power[positive] / reference)
    return values


def fit_decay(times, edc, noise_floor):
    metrics, r2, fits, reasons = {}, {}, {}, {}
    finite = edc[np.isfinite(edc)]
    for name, (high, low) in _FIT_RANGES.items():
        metrics[name] = r2[name] = fits[name] = None
        if noise_floor is not None and low < noise_floor + 5:
            reasons[name] = "Fit lower bound is less than 5 dB above the noise floor"
            continue
        if finite.size == 0 or finite[-1] > low:
            reasons[name] = f"EDC does not reach {low} dB"
            continue
        inside = (edc <= high) & (edc >= low)
        x, y = times[inside], edc[inside]
        if len(x) < 2:
            reasons[name] = "Not enough EDC points in the fit range"
            continue
        slope, intercept = line_fit(x, y)
        if slope >= 0:
            reasons[name] = "Fit range has no descending decay"
            continue
        fit = slope * x + intercept
        residual = y - fit
        centered = y - y.mean()
        metrics[name] = -60 / slope
        r2[name] = float(1 - np.dot(residual, residual) / np.dot(centered, centered))
        fits[name] = [[float(x[0]), float(fit[0])], [float(x[-1]), float(fit[-1])]]
    return metrics, r2, fits, reasons


def plot_samples(power, limit):
    if len(power) <= limit:
        return np.arange(len(power))
    edges = np.linspace(0, len(power), limit + 1, dtype=np.intp)
    # Retain narrow arrivals in the envelope and use their indices for the paired EDC.
    indices = [
        start + power[start:stop].argmax()
        for start, stop in zip(edges[:-1], edges[1:], strict=True)
    ]
    indices[-1] = len(power) - 1
    return np.asarray(indices)


def json_levels(values):
    return [float(value) if isfinite(value) else None for value in values]


def band_result(h, power, onset, peak, sr, use_lundeby, override, max_points, sos):
    decay_power = (
        power.cpu().numpy().astype(np.float64)
        if sos is None
        else np.square(sosfilt(sos, h[::-1])[::-1])
    )
    decay_onset = onset if sos is None else onset_sample(decay_power)
    model = (
        lundeby(decay_power, decay_onset, sr) if use_lundeby and decay_onset is not None else None
    )
    if override is not None:
        cutoff = override
    elif model is not None:
        cutoff = round(model.time * sr)
    else:
        cutoff = len(h)
    tail = model.tail(cutoff, sr) if model is not None and cutoff < len(h) else 0.0
    edc = np.full(len(h), np.nan)
    if decay_onset is not None and decay_onset < cutoff:
        if sos is None:
            decay = power[decay_onset:cutoff]
        else:
            decay = torch.as_tensor(
                decay_power[decay_onset:cutoff], dtype=power.dtype, device=power.device
            )
        summed = (decay.flip(0).cumsum(0).flip(0) + tail).cpu().numpy()
        edc[decay_onset:cutoff] = db_levels(summed, summed[0])
    times = np.arange(len(h), dtype=np.float64) / sr
    noise_floor = None if model is None else model.floor_db
    decay_metrics, r2, fits, reasons = fit_decay(times, edc, noise_floor)
    energy, energy_reasons = energy_metrics(h, sr, onset, peak, cutoff, sos, tail)
    reasons.update(energy_reasons)
    if model is None:
        reasons["noise_floor_db"] = (
            "No stationary noise floor was found" if use_lundeby else "Lundeby is disabled"
        )
    metrics = {
        **decay_metrics,
        **energy,
        "r2": r2,
        "noise_floor_db": noise_floor,
        "crosspoint_s": cutoff / sr,
        "reasons": reasons,
    }
    if sos is None:
        metrics["onset_s"] = None if onset is None else onset / sr
        metrics["PNR"] = (
            None if model is None else 10 * log10(decay_power[peak] / model.noise_power)
        )
        if onset is None:
            reasons["onset_s"] = "IR contains no nonzero samples"
        if model is None:
            reasons["PNR"] = reasons["noise_floor_db"]
    indices = plot_samples(decay_power, max_points)
    envelope = db_levels(decay_power[indices], decay_power.max())
    return metrics, {
        "times_s": times[indices].tolist(),
        "envelope_db": json_levels(envelope),
        "edc_db": json_levels(edc[indices]),
        "fits": fits,
    }


@torch.no_grad()
def analyze_rir(h, sr, bands, use_lundeby, truncation_s=None):
    """Analyze one impulse response and return lane-local metrics and plot data."""
    if not isinstance(sr, Integral) or sr <= 0:
        raise ValueError("Sample rate must be a positive integer")
    if (isinstance(h, torch.Tensor) and h.is_complex()) or (
        isinstance(h, np.ndarray) and np.iscomplexobj(h)
    ):
        raise ValueError("RIR samples must be real")
    source = input_tensor(h)
    if not source.numel() or not source[0].isfinite().all():
        raise ValueError("RIR must contain finite samples")
    signal = source[0]
    h = signal.cpu().numpy().astype(np.float64)
    available = octave_bands(sr)
    selected = available if bands is None else tuple(dict.fromkeys(bands))
    if any(band not in available for band in selected):
        raise ValueError("Select supported octave-band centers for this sample rate")
    override = None
    if truncation_s is not None:
        if not 0 < truncation_s <= len(h) / sr:
            raise ValueError("RIR cutoff must lie within the lane duration")
        override = round(truncation_s * sr)

    power = signal.square()
    peak_power, peak_index = power.max(dim=0)
    onset = int((power >= peak_power / 100).to(power.dtype).argmax()) if peak_power > 0 else None
    peak = int(peak_index)
    max_points = min(4000, 9000 // (3 * (1 + len(selected))))
    all_metrics, all_curves = {}, {}
    for band in (None, *selected):
        sos = None
        if band is not None:
            sos = butter(3, [band / sqrt(2), band * sqrt(2)], btype="bandpass", fs=sr, output="sos")
        name = "broadband" if band is None else str(int(band))
        all_metrics[name], all_curves[name] = band_result(
            h, power, onset, peak, sr, use_lundeby, override, max_points, sos
        )
    return {"bands": all_metrics, "curves": all_curves}


def rir_metrics(h, sr, bands=None, use_lundeby=True) -> dict:
    """Analyze a mono impulse response or the first channel of a multichannel response."""
    return analyze_rir(h, sr, bands, use_lundeby)
