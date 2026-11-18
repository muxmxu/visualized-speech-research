"""Visualized Speech Research public API."""

from vsr.presets import resolve_preset, spec_line

__all__ = ["resolve_preset", "spec_line"]


def __getattr__(name):
    if name == "dsp":
        from importlib import import_module

        module = import_module("vsr.dsp")
        globals()[name] = module
        return module
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
