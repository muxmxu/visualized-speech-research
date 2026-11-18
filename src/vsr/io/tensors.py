"""Load and interpret tensors from supported files and framed uploads."""

import math
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
import torch
from pydantic import BaseModel, Field, FiniteFloat, JsonValue, model_validator

TENSOR_EXTENSIONS = {".pt", ".pth", ".npy", ".npz", ".safetensors"}
_MAX_SAFE_JS_INTEGER = 2**53 - 1

PositiveInt = Annotated[int, Field(gt=0, strict=True)]
PositiveFloat = Annotated[FiniteFloat, Field(gt=0)]
Tensor = torch.Tensor | np.ndarray
KeyPath = list[JsonValue]


class TensorInputError(ValueError):
    pass


class LinearAxis(BaseModel):
    type: Literal["linear"]
    f_max: PositiveFloat


class MelAxis(BaseModel):
    type: Literal["mel"]
    n_mels: PositiveInt
    fmin: Annotated[FiniteFloat, Field(ge=0)]
    fmax: PositiveFloat
    htk: bool = Field(strict=True)

    @model_validator(mode="after")
    def validate_range(self):
        if self.fmax <= self.fmin:
            raise ValueError("Mel upper frequency must exceed the lower frequency")
        return self


class IndexAxis(BaseModel):
    type: Literal["index"]


class AudioInterpretation(BaseModel):
    kind: Literal["audio"]
    layout: Literal["[N]", "[C,N]", "[N,C]", "[B,N]", "[B,C,N]"]
    sr: PositiveInt


class FeatureInterpretation(BaseModel):
    kind: Literal["feature"]
    axes: Literal["[F,T]", "[T,F]", "[B,F,T]", "[B,T,F]"]
    sr: PositiveInt
    hop: PositiveInt
    freq_axis: Annotated[LinearAxis | MelAxis | IndexAxis, Field(discriminator="type")]
    value_scale: Literal["magnitude", "power", "db", "ln_magnitude", "log10_magnitude", "raw"]


Interpretation = Annotated[AudioInterpretation | FeatureInterpretation, Field(discriminator="kind")]


def load_tensors(path: Path):
    suffix = path.suffix.lower()
    if suffix in {".pt", ".pth"}:
        return torch.load(path, weights_only=True, map_location="cpu")
    if suffix in {".npy", ".npz"}:
        with path.open("rb") as file:
            loaded = np.load(file, allow_pickle=False)
            if isinstance(loaded, np.ndarray):
                if suffix != ".npy":
                    raise TensorInputError("Expected a NumPy archive")
                return loaded
            with loaded:
                if suffix != ".npz":
                    raise TensorInputError("Expected a single NumPy array")
                return dict(loaded.items())
    try:
        from safetensors import SafetensorError
        from safetensors.torch import load_file
    except ModuleNotFoundError as exc:
        raise TensorInputError("Install the safetensors extra to open .safetensors files") from exc
    try:
        return load_file(path, device="cpu")
    except SafetensorError as exc:
        raise TensorInputError(str(exc)) from exc


def _key_component(key) -> JsonValue:
    if isinstance(key, tuple):
        return [_key_component(item) for item in key]
    # Objects distinguish encoded keys from strings and tuples of ordinary keys.
    if isinstance(key, bytes):
        return {"bytes": key.hex()}
    if isinstance(key, int) and abs(key) > _MAX_SAFE_JS_INTEGER:
        return {"int": str(key)}
    if key is None or isinstance(key, str | bool | int):
        return key
    if isinstance(key, float) and math.isfinite(key):
        if abs(key) > _MAX_SAFE_JS_INTEGER:
            return {"float": key.hex()}
        return key
    raise TensorInputError("Unsupported dictionary key in tensor file")


def _leaves(value, path: KeyPath):
    if isinstance(value, torch.Tensor | np.ndarray):
        yield path, value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield from _leaves(item, [*path, _key_component(key)])
    elif isinstance(value, tuple | list):
        for index, item in enumerate(value):
            yield from _leaves(item, [*path, index])


def tensor_tree(value) -> list[dict]:
    return [
        {
            "key_path": path,
            "shape": list(leaf.shape),
            "dtype": str(leaf.dtype).removeprefix("torch."),
        }
        for path, leaf in _leaves(value, [])
    ]


def tensor_leaf(value, key_path: KeyPath) -> Tensor:
    for path, leaf in _leaves(value, []):
        if path == key_path:
            return leaf
    raise TensorInputError("The selected key path does not identify a tensor")


def feature_scale(values, scale):
    if scale == "magnitude":
        return 20 * np.log10(np.maximum(values, 1e-10))
    if scale == "power":
        return 10 * np.log10(np.maximum(values, 1e-20))
    if scale == "ln_magnitude":
        return values * (20 / math.log(10))
    if scale == "log10_magnitude":
        return values * 20
    return values


def interpret_tensor(value: Tensor, interpretation: Interpretation) -> tuple[torch.Tensor, dict]:
    audio = isinstance(interpretation, AudioInterpretation)
    axes = interpretation.layout if audio else interpretation.axes
    if value.ndim != axes.count(",") + 1 or 0 in value.shape:
        raise TensorInputError(f"Tensor must have nonempty dimensions matching {axes}")
    batched = axes.startswith("[B,")
    if batched and value.shape[0] > 32:
        raise TensorInputError("A tensor batch may contain at most 32 lanes")

    if isinstance(value, torch.Tensor):
        if value.layout != torch.strided or value.is_quantized:
            raise TensorInputError("Tensor lanes require dense, unquantized data")
        complex_values = value.is_complex()
        integer = not (complex_values or value.is_floating_point() or value.dtype == torch.bool)
    else:
        if value.dtype.kind not in "bfiuc":
            raise TensorInputError("Tensor lanes require numeric data")
        complex_values = value.dtype.kind == "c"
        integer = value.dtype.kind in "iu"
    if complex_values:
        if audio:
            raise TensorInputError("Complex tensors require feature interpretation")
        value = abs(value)
    if integer and audio:
        info = (
            torch.iinfo(value.dtype) if isinstance(value, torch.Tensor) else np.iinfo(value.dtype)
        )
        midpoint = 2 ** (info.bits - 1)
        if info.min == 0:
            samples = value.detach().numpy() if isinstance(value, torch.Tensor) else value
            # Flipping the sign bit centers offset-binary PCM at integer precision.
            centered = np.bitwise_xor(samples, midpoint)
            value = centered.view(f"i{centered.itemsize}")
    if isinstance(value, torch.Tensor):
        data = value.detach().to(device="cpu", dtype=torch.float32)
    else:
        data = torch.from_numpy(value.astype(np.float32, order="C", copy=True))
    if integer and audio:
        data /= float(midpoint)
    if not data.isfinite().all():
        raise TensorInputError("Tensor lane data must contain finite float32 values")

    if axes in {"[N,C]", "[T,F]", "[B,T,F]"}:
        data = data.transpose(-1, -2)
    if axes in {"[N]", "[B,N]"}:
        data = data.unsqueeze(-2)
    if not batched:
        data = data.unsqueeze(0)
    fields = {"kind": interpretation.kind, "sr": interpretation.sr}
    if not audio:
        axis = interpretation.freq_axis
        if isinstance(axis, MelAxis) and axis.n_mels != data.shape[1]:
            raise TensorInputError("Mel channel count must match the tensor row count")
        scale = "magnitude" if complex_values else interpretation.value_scale
        if scale != "raw":
            # Each display scale is monotone, so the two extrema bound the encoded data.
            extrema = torch.stack(torch.aminmax(data)).numpy()
            try:
                with np.errstate(over="raise"):
                    feature_scale(extrema, scale).astype(np.float16)
            except FloatingPointError as exc:
                raise TensorInputError("Converted feature values exceed the float16 range") from exc
        fields.update(
            frame_rate=interpretation.sr / interpretation.hop,
            freq_axis=axis.model_dump(),
            value_scale=scale,
        )
    return data.contiguous(), fields
