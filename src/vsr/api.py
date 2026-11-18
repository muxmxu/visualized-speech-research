"""Public analyzer declarations and compute device."""

from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from typing import Literal

import numpy as np
import torch

Array = torch.Tensor | np.ndarray

_device = "cpu"
_dataset_cpu = ContextVar("vsr_dataset_cpu", default=False)


def compute_device() -> torch.device:
    return torch.device("cpu" if _dataset_cpu.get() else _device)


@contextmanager
def _dataset_cpu_scope():
    token = _dataset_cpu.set(True)
    try:
        yield
    finally:
        _dataset_cpu.reset(token)


@dataclass(frozen=True)
class Param:
    default: float | int | bool | str
    min: float | None = None
    max: float | None = None
    step: float | None = None
    choices: list[float | int | bool | str] | None = None
    unit: str | None = None
    label: str | None = None


def analyzer(*, id: str, label: str, version: int, input: Literal["audio", "feature"]):
    """Declare an analyzer in a built-in or configured plugin module."""
    if (
        not id
        or "/" in id
        or not label
        or type(version) is not int
        or input not in ("audio", "feature")
    ):
        raise ValueError("Invalid analyzer id, label, version, or input kind")

    def decorate(function):
        function.__vsr_analyzer__ = {"id": id, "label": label, "version": version, "input": input}
        return function

    return decorate


@dataclass
class TimeFreqImage:
    values: Array
    frame_rate: float
    frame_t0: float
    freq_axis: dict
    value_scale: str


@dataclass
class TimeCurve:
    times: Array
    values: Array
    unit: str
    overlay: Literal["freq", "lane"] = "lane"
    y_scale: Literal["linear", "log"] = "linear"
    labels: list[str] | None = None


@dataclass
class Events:
    items: list[tuple[float, float, str]]


@dataclass
class Spectrum:
    freqs: Array
    values: Array
    unit: str
    labels: list[str] | None = None


@dataclass
class Scalars:
    values: dict[str, float]


@dataclass
class Audio:
    wav: Array
    sr: int
