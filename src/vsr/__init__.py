"""Visualized Speech Research public API."""

import json
import os
import socket
from importlib import import_module
from urllib.error import HTTPError, URLError
from urllib.request import ProxyHandler, Request, build_opener, urlopen

from vsr.config import home
from vsr.presets import resolve_preset, spec_line

__all__ = ["resolve_preset", "show", "spec_line"]

_START_SERVER = "No running vsr server. Start it with `vsr serve`."


def __getattr__(name):
    if name in {"dsp", "plot"}:
        module = import_module(f"vsr.{name}")
        globals()[name] = module
        return module
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def _show_connection():
    if (url := os.environ.get("VSR_URL")) is not None:
        token = os.environ.get("VSR_TOKEN")
        if not token:
            raise RuntimeError("Set VSR_TOKEN when using VSR_URL.")
        return url.rstrip("/"), token, urlopen

    try:
        runtime = json.loads((home() / "runtime.json").read_text())
        if runtime["hostname"] != socket.gethostname():
            raise RuntimeError("The vsr runtime hostname differs from this host. Use VSR_URL.")
        os.kill(runtime["pid"], 0)
    except (FileNotFoundError, ProcessLookupError) as exc:
        raise RuntimeError(_START_SERVER) from exc
    direct_opener = build_opener(ProxyHandler({}))
    return f"http://127.0.0.1:{runtime['port']}", runtime["token"], direct_opener.open


def _audio_layout(shape) -> str:
    if len(shape) == 1:
        return "[N]"
    if len(shape) == 2:
        if shape[0] <= 8:
            return "[C,N]"
        if shape[1] <= 8:
            return "[N,C]"
    raise ValueError("Cannot infer audio layout. Pass layout= or kind='feature'.")


def _show_array(x, kind):
    import numpy as np
    import torch

    if isinstance(x, torch.Tensor):
        if x.layout != torch.strided or x.is_quantized:
            raise ValueError("Tensor lanes require dense, unquantized data")
        x = x.detach().cpu()
        complex_values = x.is_complex()
    elif isinstance(x, np.ndarray) and x.dtype.kind in "bfiuc":
        complex_values = x.dtype.kind == "c"
    else:
        raise ValueError("Tensor lanes require a numeric NumPy array or torch tensor")
    if complex_values:
        if kind == "audio":
            raise ValueError("Complex tensors require feature interpretation")
        x = abs(x)
    if isinstance(x, torch.Tensor):
        if x.is_floating_point():
            x = x.float()
        x = x.numpy(force=True)

    if kind == "audio" and x.dtype.kind in "iu":
        info = np.iinfo(x.dtype)
        midpoint = 2 ** (info.bits - 1)
        if info.min == 0:
            # Center offset-binary PCM before casting to preserve neighbors of the midpoint.
            centered = np.bitwise_xor(x, midpoint)
            x = centered.view(f"i{centered.itemsize}")
        return x.astype(np.float32, order="C") / float(midpoint), complex_values
    return x.astype(np.float32, order="C", copy=False), complex_values


def show(
    x,
    *,
    sr: int,
    name: str = "tensor",
    kind: str = "audio",
    layout: str | None = None,
    hop: int | None = None,
    freq_axis: dict | None = None,
    value_scale: str | None = None,
) -> None:
    """Push a tensor or a dictionary of named tensors to a running vsr server."""
    from vsr.frame import encode_frame

    url, token, open_request = _show_connection()
    entries = x.items() if isinstance(x, dict) else ((name, x),)
    for lane_name, value in entries:
        data, complex_values = _show_array(value, kind)
        if kind == "audio":
            interpretation = {"layout": _audio_layout(data.shape) if layout is None else layout}
        else:
            interpretation = {
                "axes": "[F,T]",
                "hop": hop,
                "freq_axis": freq_axis,
                "value_scale": "magnitude" if complex_values else value_scale,
            }
        frame = encode_frame(
            data, {"name": lane_name, "kind": kind, "sr": sr, "interpretation": interpretation}
        )
        request = Request(
            f"{url}/api/push",
            data=frame,
            headers={"Content-Type": "application/octet-stream"},
        )
        request.add_unredirected_header("Authorization", f"Bearer {token}")
        try:
            with open_request(request) as response:
                response.read()
        except HTTPError:
            raise
        except (URLError, TimeoutError) as exc:
            raise RuntimeError(_START_SERVER) from exc
