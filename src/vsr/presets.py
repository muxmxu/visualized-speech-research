"""Resolve the bundled visualization presets."""

import math
import tomllib
from importlib.resources import files


def preset_definitions() -> dict:
    resource = files("vsr").joinpath("skills/vsr-speech-visualization/presets.toml")
    with resource.open("rb") as stream:
        return {
            name: value for name, value in tomllib.load(stream).items() if isinstance(value, dict)
        }


def resolve_preset(name: str, sr: int, **overrides) -> dict:
    preset = preset_definitions()[name]
    preset.update(overrides)
    samples = preset["win_ms"] * sr / 1000
    win = (
        2 ** math.floor(math.log2(samples) + 0.5)
        if preset["pow2_win"]
        else math.floor(samples + 0.5)
    )
    win = overrides.get("win_length", win)
    hop = math.floor(
        (preset["hop_ms"] * sr / 1000 if "hop_ms" in preset else win * preset["hop_ratio"]) + 0.5
    )
    hop = overrides.get("hop", hop)
    n_fft = overrides.get("n_fft", 2 ** math.ceil(math.log2(win * preset["nfft_factor"])))
    result = preset | {
        "name": name,
        "sr": sr,
        "win_length": win,
        "hop": hop,
        "n_fft": n_fft,
        "f_max_hz": min(preset["f_max_hz"] or sr / 2, sr / 2),
    }
    if overrides:
        baseline = resolve_preset(name, sr)
        changed = [key for key in overrides if result[key] != baseline.get(key)]
        if changed:
            result["overrides"] = changed
    return result


def spec_line(params: dict) -> str:
    obj = params.get("object", "preset=" + params.get("name", "analysis"))
    params = dict(params)
    if "win_length" in params:
        params.setdefault("win", params["win_length"])
    if "yscale" in params:
        params.setdefault(
            "y", f"{params['yscale']} {params['f_min_hz']:g}-{params['f_max_hz']:g}Hz"
        )
    parts = ["vsr-spec v1", obj]
    for key in (
        "sr",
        "mode",
        "window",
        "win",
        "hop",
        "n_fft",
        "y",
        "value",
        "stats",
        "db",
        "range",
        "cmap",
        "overrides",
    ):
        if key in params:
            value = params[key]
            if key == "window" and value in ("kaiser", "gaussian"):
                default = 8.6 if value == "kaiser" else 0.125
                value = f"{value}({params.get('window_param', default)})"
            if key in ("stats", "overrides") and not isinstance(value, str):
                value = ",".join(value)
            if key == "db" and value == "auto80":
                continue
            if key == "mode" and value == "stft":
                continue
            if key == "range" and not isinstance(value, str):
                value = f"[{value[0]},{value[1]}]"
            if key == "db" and not isinstance(value, str):
                unit = {"dbfs": "dBFS", "db_per_hz": "dB/Hz", "db": "dB"}[
                    params.get("unit", "dbfs")
                ]
                value = f"[{value[0]},{value[1]}] {unit}"
            parts.append(f"{key}={value}")
    return " | ".join(parts)
