"""Built-in energy, voice activity, pitch, and spectrogram inversion analyzers."""

import numpy as np
from scipy.interpolate import interp1d
from scipy.linalg import pinv

from vsr.api import Audio, Events, Param, TimeCurve, analyzer, compute_device
from vsr.dsp.mel import mel_filterbank
from vsr.dsp.spectrum import active_frames, activity_geometry, frame_rms
from vsr.presets import resolve_preset


@analyzer(id="energy", label="Energy", version=1, input="audio")
def energy(x, sr):
    times, rms = frame_rms(x, sr)
    return TimeCurve(times.cpu(), (20 * rms.log10()).cpu(), "dBFS", labels=["RMS"])


@analyzer(id="vad.energy", label="Energy VAD", version=1, input="audio")
def vad_energy(
    x,
    sr,
    *,
    min_speech_ms: float = Param(100.0, min=0, unit="ms", label="Minimum speech"),
    min_silence_ms: float = Param(100.0, min=0, unit="ms", label="Minimum silence"),
):
    _, active = active_frames(x, sr)
    window, hop = activity_geometry(sr)
    transitions = np.flatnonzero(np.diff(active.numpy().astype(np.int8), prepend=0, append=0))
    minimum_speech = round(min_speech_ms * sr / 1000)
    minimum_silence = round(min_silence_ms * sr / 1000)
    spans = []
    for first, last in transitions.reshape(-1, 2):
        start, end = int(first) * hop, (int(last) - 1) * hop + window
        if spans and start - spans[-1][1] <= minimum_silence:
            spans[-1] = (spans[-1][0], end)
        else:
            spans.append((start, end))
    return Events(
        [(start / sr, end / sr, "Speech") for start, end in spans if end - start >= minimum_speech]
    )


@analyzer(id="f0", label="F0", version=1, input="audio")
def f0(
    x,
    sr,
    *,
    f0_floor: float = Param(71.0, min=40, max=400, unit="Hz", label="F0 floor"),
    f0_ceil: float = Param(800.0, min=200, max=1600, unit="Hz", label="F0 ceiling"),
):
    mono = x.numpy().mean(axis=0)
    try:
        from pyworld import harvest
    except ModuleNotFoundError as exc:
        if exc.name != "pyworld":
            raise
        from librosa import pyin

        hop = round(sr * 0.01)
        frame = max(2048, round(2 * sr / f0_floor))
        pitch, _, _ = pyin(
            mono, fmin=f0_floor, fmax=f0_ceil, sr=sr, frame_length=frame, hop_length=hop
        )
        times = np.arange(len(pitch)) * hop / sr
        method = "pYIN"
    else:
        pitch, times = harvest(mono.astype(np.float64), sr, f0_floor=f0_floor, f0_ceil=f0_ceil)
        pitch[pitch == 0] = np.nan
        method = "WORLD Harvest"
    return TimeCurve(times, pitch, "Hz", overlay="freq", y_scale="log", labels=[method])


def feature_magnitude(x, scale):
    match scale:
        case "magnitude":
            return x
        case "power":
            return np.sqrt(x)
        case "db":
            return np.power(10, x / 20)
        case "ln_magnitude":
            return np.exp(x)
        case "log10_magnitude":
            return np.power(10, x)


@analyzer(id="griffinlim", label="Griffin–Lim", version=1, input="feature")
def griffinlim(
    x,
    sr,
    *,
    frame_rate,
    freq_axis,
    value_scale,
    n_iter: int = Param(32, min=1, label="Iterations"),
    n_fft: int = Param(0, min=0, label="FFT size (0 = auto)"),
    hop: int = Param(0, min=0, unit="samples", label="Hop (0 = source)"),
):
    from librosa import griffinlim as reconstruct

    axis = freq_axis["type"]
    if axis == "index" or value_scale == "raw":
        raise ValueError("Griffin–Lim requires a linear or mel feature with a magnitude scale")
    if n_fft == 0:
        n_fft = (
            2 * (x.shape[0] - 1) if axis == "linear" else resolve_preset("analysis", sr)["n_fft"]
        )
    hop = hop or round(sr / frame_rate)
    if not 0 < hop <= n_fft or n_fft < 2:
        raise ValueError("Griffin–Lim requires 0 < hop <= n_fft and n_fft >= 2")

    magnitude = feature_magnitude(x.numpy(), value_scale)
    if axis == "mel":
        filterbank = (
            mel_filterbank(
                sr,
                n_fft,
                x.shape[0],
                freq_axis["fmin"],
                freq_axis["fmax"],
                freq_axis["htk"],
                compute_device(),
            )
            .cpu()
            .numpy()
        )
        power = pinv(filterbank) @ magnitude**2
        # DESIGN §8.3 mel stores nonnegative power before §12 inversion.
        magnitude = np.sqrt(np.maximum(power, 0))
    elif magnitude.shape[0] != n_fft // 2 + 1 or freq_axis["f_max"] != sr / 2 or n_fft % 2:
        source_freqs = np.linspace(0, freq_axis["f_max"], x.shape[0])
        target_freqs = np.fft.rfftfreq(n_fft, 1 / sr)
        magnitude = interp1d(source_freqs, magnitude, axis=0, bounds_error=False, fill_value=0)(
            target_freqs
        ).astype(np.float32)

    # Use the longest signal that has this many centered STFT frames on the requested grid.
    length = magnitude.shape[1] * hop - 1 + n_fft % 2
    wav = reconstruct(magnitude, n_iter=n_iter, n_fft=n_fft, hop_length=hop, length=length)
    return Audio(wav[None, :], sr)
