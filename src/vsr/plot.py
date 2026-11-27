"""Static speech figures using the shared DSP and visualization presets."""

import math
import os
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from matplotlib.figure import Figure

from vsr import dsp, resolve_preset, spec_line

_UNITS = {"dbfs": "dBFS", "db_per_hz": "dB/Hz", "db": "dB"}


def _time_axis(duration):
    return (1000, "Time (ms)") if duration < 1 else (1, "Time (s)")


def _db_limits(db, values):
    if isinstance(db, str) and db == "auto80":
        ceiling = 10 * math.ceil(max(float(value.max()) for value in values) / 10)
        return ceiling - 80, ceiling
    return tuple(db)


def _record_spec(fig, params):
    line = spec_line(params)
    vars(fig).setdefault("_vsr_specs", []).append(line)
    return line


def _spectrogram_data(x, params):
    sr = params["sr"]
    mode = params.get("mode", "stft")
    if mode == "mel":
        params.setdefault("n_mels", 128)
        params.setdefault("fmin", 0.0)
        params.setdefault("fmax", sr / 2)
        params.setdefault("htk", False)
        params["yscale"] = "linear"
        params["f_min_hz"] = max(params["f_min_hz"], params["fmin"])
        params["f_max_hz"] = min(params["f_max_hz"], params["fmax"])
        values, times, frequencies = dsp.mel_db(x, **params)
    elif mode == "stft":
        values, times, frequencies = dsp.stft_db(x, **params)
        if params["yscale"] == "log":
            params["f_min_hz"] = max(params["f_min_hz"], 20, sr / params["n_fft"])
    else:
        raise ValueError(f"Unknown spectrogram mode: {mode}")
    rows = (frequencies >= params["f_min_hz"]) & (frequencies <= params["f_max_hz"])
    if not rows.any():
        raise ValueError("Spectrogram frequency range contains no bin centers")
    return values[:, rows].numpy(), times.numpy(), frequencies[rows].numpy()


def _mel_label(params):
    scale = "htk" if params["htk"] else "slaney"
    return f"mel({params['n_mels']}, {params['fmin']:g}-{params['fmax']:g}Hz, {scale})"


def _draw_spectrogram(ax, values, times, frequencies, params, time_scale, f0=None):
    time_step = params["hop"] / params["sr"]
    time_edges = np.r_[times - time_step / 2, times[-1] + time_step / 2] * time_scale
    if params.get("mode") == "mel":
        from librosa import hz_to_mel

        htk = params["htk"]
        centers = hz_to_mel(frequencies.astype(np.float64), htk=htk)
        bounds = hz_to_mel([params["fmin"], params["fmax"]], htk=htk)
        frequency_step = (bounds[1] - bounds[0]) / (params["n_mels"] + 1)
        axis_limits = hz_to_mel([params["f_min_hz"], params["f_max_hz"]], htk=htk)
        ticks = np.linspace(0, len(centers) - 1, min(6, len(centers)), dtype=int)
        ax.set_yscale("linear")
        ax.set_yticks(centers[ticks], [f"{frequency:.4g}" for frequency in frequencies[ticks]])
        ax.set_ylabel(f"Frequency (Hz, {_mel_label(params)})")
    else:
        centers = frequencies
        frequency_step = params["sr"] / params["n_fft"]
        axis_limits = params["f_min_hz"], params["f_max_hz"]
        ax.set_yscale(params["yscale"])
        ax.set_ylabel("Frequency (Hz, log)" if params["yscale"] == "log" else "Frequency (Hz)")
    frequency_edges = np.r_[centers - frequency_step / 2, centers[-1] + frequency_step / 2]
    mesh = ax.pcolormesh(
        time_edges,
        frequency_edges,
        values,
        cmap=params["cmap"],
        vmin=params["db"][0],
        vmax=params["db"][1],
        shading="flat",
        rasterized=True,
    )
    ax.set_ylim(*axis_limits)
    if f0 is not None:
        times, hz = (np.asarray(array) for array in f0)
        if params.get("mode") == "mel":
            hz = hz_to_mel(hz, htk=htk)
        ax.plot(times * time_scale, hz, color="cyan", label="F0")
        ax.legend()
    return mesh


@torch.no_grad()
def spectrogram(ax, x, sr, preset="analysis", db=None, f0=None, **overrides) -> str:
    """Plot a calibrated spectrogram and optionally overlay F0 in Hz."""
    if db is not None:
        overrides["db"] = db
    params = resolve_preset(preset, sr, **overrides)
    if params["cmap"] not in ("magma", "gray_r"):
        raise ValueError(
            f"Static spectrogram colormap must be magma or gray_r, got {params['cmap']!r}"
        )
    values, times, frequencies = _spectrogram_data(x, params)
    duration = x.shape[-1] / sr
    time_scale, time_label = _time_axis(duration)
    params["db"] = _db_limits(params["db"], [values[0]])
    mesh = _draw_spectrogram(ax, values[0], times, frequencies, params, time_scale, f0)
    ax.set_xlabel(time_label)
    ax.set_xlim(0, duration * time_scale)
    if len(values) > 1:
        ax.set_title("Channel 1")
    ax.figure.colorbar(mesh, ax=ax, label="dBFS")
    if params.get("mode") == "mel":
        params["mode"] = _mel_label(params)
    return _record_spec(ax.figure, params | {"unit": "dbfs"})


@torch.no_grad()
def compare(
    signals: dict, sr, preset="analysis", waveform=False, db=None, diff=None
) -> tuple[Figure, str]:
    """Compare signals on a shared timeline, optionally showing A minus B in dB."""
    params = resolve_preset(preset, sr, **({"db": db} if db is not None else {}))
    if diff is not None:
        left, right = (signals[name] for name in diff)
        if left.shape[-1] != right.shape[-1]:
            raise ValueError("Difference requires sample-aligned signals with equal lengths")

    names = sorted(signals, key=lambda name: name.casefold() != "gt")
    spectra = {name: _spectrogram_data(signals[name], params) for name in names}
    params["db"] = _db_limits(params["db"], [data[0] for data in spectra.values()])
    params["unit"] = "dbfs"
    if diff is not None:
        left_values = spectra[diff[0]][0]
        right_values = spectra[diff[1]][0]
        if len(left_values) != len(right_values):
            raise ValueError("Difference requires the same number of channels")
        delta = left_values - right_values
        limit = float(np.abs(delta).max()) or 1
        difference_params = params | {"db": (-limit, limit), "cmap": "RdBu_r", "unit": "db"}

    duration = max(signal.shape[-1] for signal in signals.values()) / sr
    time_scale, time_label = _time_axis(duration)
    num_axes = sum(len(values) for values, _, _ in spectra.values())
    num_axes += len(signals) if waveform else 0
    num_axes += len(delta) if diff is not None else 0
    fig, axes = plt.subplots(
        num_axes, sharex=True, squeeze=False, figsize=(7, 2.5 * num_axes), layout="constrained"
    )
    panels = iter(axes[:, 0])
    waveform_axis = None
    for name, (values, times, frequencies) in spectra.items():
        if waveform:
            ax = next(panels)
            if waveform_axis is None:
                waveform_axis = ax
            else:
                ax.sharey(waveform_axis)
            x = signals[name]
            samples = x.detach().cpu().float().numpy() if isinstance(x, torch.Tensor) else x
            ax.plot(np.arange(x.shape[-1]) * time_scale / sr, np.atleast_2d(samples).T)
            ax.set_ylabel("Amplitude")
            ax.set_title(name)
        for channel, channel_db in enumerate(values, start=1):
            ax = next(panels)
            mesh = _draw_spectrogram(ax, channel_db, times, frequencies, params, time_scale)
            ax.set_title(name if len(values) == 1 else f"{name} · Channel {channel}")
            fig.colorbar(mesh, ax=ax, label="dBFS")
    line = _record_spec(fig, params)
    if diff is not None:
        _, times, frequencies = spectra[diff[0]]
        title = f"{diff[0]} − {diff[1]}"
        for channel, channel_db in enumerate(delta, start=1):
            ax = next(panels)
            mesh = _draw_spectrogram(
                ax, channel_db, times, frequencies, difference_params, time_scale
            )
            ax.set_title(title if len(delta) == 1 else f"{title} · Channel {channel}")
            fig.colorbar(mesh, ax=ax, label="dB")
        line += "\n" + _record_spec(fig, difference_params)
    axes[-1, 0].set_xlabel(time_label)
    axes[-1, 0].set_xlim(0, duration * time_scale)
    return fig, line


@torch.no_grad()
def spectrum(ax, signals: dict, sr, preset="ltas", stats=("mean", "p10", "p90")) -> str:
    """Overlay Welch statistics per signal and show p10–p90 as an interval."""
    params = resolve_preset(preset, sr)
    unit = params.get("unit", "dbfs")
    stats = tuple(stats)
    welch_params = {key: params[key] for key in ("n_fft", "win_length", "hop", "window")}
    for name, x in signals.items():
        values, frequencies = dsp.welch(
            x,
            sr,
            stats=stats,
            unit=unit,
            active_only=params.get("active_only", False),
            **welch_params,
        )
        visible = (frequencies >= params["f_min_hz"]) & (frequencies <= params["f_max_hz"])
        frequencies = frequencies[visible].numpy()
        for channel, channel_values in enumerate(values[:, :, visible].numpy(), start=1):
            label = name if len(values) == 1 else f"{name} · Channel {channel}"
            curves = dict(zip(stats, channel_values, strict=True))
            interval = "p10" in curves and "p90" in curves
            color = None
            for index, (stat, curve) in enumerate(curves.items()):
                if interval and stat in ("p10", "p90"):
                    continue
                (line,) = ax.plot(
                    frequencies,
                    curve,
                    color=color,
                    label=f"{label} {stat}",
                    linestyle=("-", "--", "-.", ":")[index % 4],
                )
                color = line.get_color()
            if interval:
                ax.fill_between(
                    frequencies,
                    curves["p10"],
                    curves["p90"],
                    color=color,
                    alpha=0.2,
                    label=f"{label} p10–p90",
                )
    ax.set_xscale(params["yscale"])
    ax.set_xlim(params["f_min_hz"], params["f_max_hz"])
    ax.set_xlabel("Frequency (Hz, log)" if params["yscale"] == "log" else "Frequency (Hz)")
    ax.set_ylabel(_UNITS[unit])
    ax.legend()
    plot_params = {
        key: params[key]
        for key in ("sr", "win_length", "hop", "n_fft", "window", "yscale", "f_min_hz", "f_max_hz")
    }
    plot_params.update(object="spectrum", stats=stats, unit=unit, db=ax.get_ylim())
    return _record_spec(ax.figure, plot_params)


def rir(ax, h, sr, bands=None) -> dict:
    """Draw room impulse response decay curves and return the underlying analysis."""
    result = dsp.rir_metrics(h, sr, bands=bands)
    broadband = result["curves"]["broadband"]
    time_scale, time_label = _time_axis(result["bands"]["broadband"]["crosspoint_s"])
    for name, curve in result["curves"].items():
        times = np.asarray(curve["times_s"]) * time_scale
        levels = np.asarray(curve["edc_db"], dtype=np.float64)
        label = "Broadband" if name == "broadband" else f"{name} Hz"
        ax.plot(times, levels, label=label, linewidth=2 if name == "broadband" else 1)
    for name, fit in broadband["fits"].items():
        if fit is not None:
            times, levels = np.asarray(fit).T
            ax.plot(times * time_scale, levels, linestyle="--", label=name)
    ax.set_xlabel(time_label)
    ax.set_ylabel("Energy decay (dB)")
    ax.legend()
    _record_spec(ax.figure, {"object": "rir", "sr": sr})
    return result


def savefig(fig, path, **kw) -> None:
    """Write Figure metadata with the output format's supported key."""
    output_format = kw.get("format")
    if output_format is None and isinstance(path, (str, os.PathLike)):
        output_format = Path(path).suffix.lstrip(".")
    output_format = (output_format or fig.canvas.get_default_filetype()).lower()
    key = {"png": "vsr-spec", "pdf": "Keywords"}.get(output_format)
    specs = getattr(fig, "_vsr_specs", [])
    if key is not None and specs:
        metadata = dict(kw.get("metadata") or {})
        if output_format == "pdf" and metadata.get(key):
            specs = [metadata[key], *specs]
        metadata[key] = "\n".join(specs)
        kw["metadata"] = metadata
    fig.savefig(path, **kw)
