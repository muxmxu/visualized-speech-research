"""Authenticated analyzer execution and readback."""

from copy import deepcopy
from math import isfinite

import numpy as np
import torch
from fastapi import HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    FiniteFloat,
    JsonValue,
    TypeAdapter,
    model_validator,
)

from vsr import api
from vsr.analyzers.registry import Registry
from vsr.frame import encode_frame
from vsr.io.tensors import FeatureInterpretation, PositiveInt, interpret_tensor
from vsr.server.routes_edit import sample_bound
from vsr.server.session import Lane

_positive_int = TypeAdapter(PositiveInt)


class RunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lane: str
    t0: FiniteFloat | None = None
    t1: FiniteFloat | None = None
    channel: int | None = Field(None, ge=0, strict=True)
    params: dict[str, JsonValue] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_interval(self):
        if (self.t0 is None) != (self.t1 is None) or (self.t0 is not None and self.t1 <= self.t0):
            raise ValueError("Send both increasing time bounds or omit both")
        return self


def float_array(value, name: str) -> torch.Tensor:
    if isinstance(value, torch.Tensor):
        if value.is_complex():
            raise ValueError(f"{name} must be real")
        return value.detach().to(dtype=torch.float32).cpu().contiguous()
    if isinstance(value, np.ndarray) and value.dtype.kind in "bifu":
        return torch.from_numpy(value.astype(np.float32, order="C", copy=True))
    raise ValueError(f"{name} must be a real tensor or NumPy array")


def series(axis, values, labels, unit):
    axis = float_array(axis, "Analyzer axis")
    values = float_array(values, "Analyzer values")
    if values.ndim == 1:
        values = values[None, :]
    if (
        axis.ndim != 1
        or not np.isfinite(axis.numpy()).all()
        or values.ndim != 2
        or values.shape[0] == 0
        or values.shape[1] != axis.shape[0]
    ):
        raise ValueError("Analyzer results need a finite axis [T] and values [T] or [K, T]")
    if not isinstance(unit, str):
        raise ValueError("Analyzer unit must be a string")
    if labels is None:
        labels = [f"Curve {index + 1}" for index in range(values.shape[0])]
    elif len(labels) != values.shape[0] or not all(isinstance(label, str) for label in labels):
        raise ValueError("Analyzer labels must match the number of curves")
    return axis, values, list(labels)


def normalize_result(result, sr):
    """Validate data at the plugin boundary before caching or publishing it."""
    if isinstance(result, api.TimeFreqImage):
        if (
            not isfinite(result.frame_rate)
            or result.frame_rate <= 0
            or not isfinite(result.frame_t0)
        ):
            raise ValueError("Feature output requires a positive frame rate and finite first time")
        # Feature validation is shared with pushed tensors; the output has its own exact frame rate.
        interpretation = FeatureInterpretation(
            kind="feature",
            axes="[F,T]",
            sr=sr,
            hop=1,
            freq_axis=result.freq_axis,
            value_scale=result.value_scale,
        )
        data, fields = interpret_tensor(result.values, interpretation)
        return api.TimeFreqImage(
            data[0],
            result.frame_rate,
            result.frame_t0,
            fields["freq_axis"],
            fields["value_scale"],
        )
    if isinstance(result, api.TimeCurve):
        if result.overlay not in ("freq", "lane") or result.y_scale not in ("linear", "log"):
            raise ValueError("Invalid curve overlay or y scale")
        times, values, labels = series(result.times, result.values, result.labels, result.unit)
        return api.TimeCurve(times, values, result.unit, result.overlay, result.y_scale, labels)
    if isinstance(result, api.Events):
        items = []
        for start, end, label in result.items:
            if (
                not isfinite(start)
                or not isfinite(end)
                or end < start
                or not isinstance(label, str)
            ):
                raise ValueError("Events require finite ordered bounds and a string label")
            items.append((float(start), float(end), label))
        return api.Events(items)
    if isinstance(result, api.Spectrum):
        freqs, values, labels = series(result.freqs, result.values, result.labels, result.unit)
        return api.Spectrum(freqs, values, result.unit, labels)
    if isinstance(result, api.Scalars):
        if not all(
            isinstance(name, str) and isfinite(value) for name, value in result.values.items()
        ):
            raise ValueError("Scalar output requires string names and finite values")
        return api.Scalars({name: float(value) for name, value in result.values.items()})
    if isinstance(result, api.Audio):
        wav = float_array(result.wav, "Analyzer audio")
        if wav.ndim != 2 or 0 in wav.shape or not np.isfinite(wav.numpy()).all():
            raise ValueError("Audio output requires a nonempty finite [C, N] array")
        return api.Audio(wav, _positive_int.validate_python(result.sr))
    raise TypeError("Analyzer returned an unsupported output type")


def slice_bounds(lane: Lane, body: RunRequest) -> tuple[int, int, float]:
    if lane.kind == "audio":
        first, last = (
            (0, lane.data.shape[1])
            if body.t0 is None
            else (sample_bound(lane, body.t0), sample_bound(lane, body.t1))
        )
        return first, last, first / lane.sr
    if body.channel is not None:
        raise HTTPException(422, "Feature inputs do not accept a channel")
    first, last = 0, lane.data.shape[1]
    if body.t0 is not None:
        centers = lane.offset + lane.frame_t0 + np.arange(last, dtype=np.float64) / lane.frame_rate
        first, last = np.searchsorted(centers, [body.t0, body.t1], side="left")
    return first, last, lane.frame_t0 + first / lane.frame_rate


def framed(arrays, header):
    return Response(
        encode_frame(arrays, header),
        media_type="application/octet-stream",
        headers={"Cache-Control": "no-store"},
    )


def result_response(result, parent, origin, entry, session):
    if isinstance(result, api.Scalars):
        return {"kind": "scalars", "lanes": [], "result": result.values}
    if isinstance(result, api.Spectrum):
        return framed(
            {"freqs": result.freqs.numpy(), "values": result.values.numpy()},
            {
                "kind": "spectrum",
                "lanes": [],
                "result": {"unit": result.unit, "labels": result.labels},
            },
        )

    fields = {"name": entry.label, "source": f"analyzer:{entry.id}", "parent": parent.id}
    if isinstance(result, api.TimeFreqImage):
        kind = "time_freq_image"
        lane = Lane(
            **fields,
            data=result.values,
            sr=parent.sr,
            kind="feature",
            offset=parent.offset + origin,
            frame_rate=result.frame_rate,
            frame_t0=result.frame_t0,
            freq_axis=result.freq_axis,
            value_scale=result.value_scale,
        )
    elif isinstance(result, api.Audio):
        kind = "audio"
        lane = Lane(
            **fields,
            data=result.wav,
            sr=result.sr,
            offset=parent.offset + origin,
        )
    elif isinstance(result, api.TimeCurve):
        kind = "time_curve"
        lane = Lane(
            **fields,
            data=None,
            sr=parent.sr,
            kind="curve",
            offset=parent.offset,
            times=torch.from_numpy(result.times.numpy() + origin),
            values=result.values,
            unit=result.unit,
            y_scale=result.y_scale,
            overlay=result.overlay == "freq",
            labels=result.labels,
        )
    else:
        kind = "events"
        lane = Lane(
            **fields,
            data=None,
            sr=parent.sr,
            kind="events",
            offset=parent.offset,
            items=[(start + origin, end + origin, label) for start, end, label in result.items],
        )
    session.publish_derived(lane)
    return {"kind": kind, "lanes": [lane.id], "result": None}


def register_analyzers(app, session, find, connections, heavy, registry: Registry) -> None:
    def refresh_plugins():
        with registry.lock:
            changed, affected = registry.refresh()
            if not changed:
                return False, False
            with session.lock:
                derived = [
                    lane
                    for lane in session.lanes
                    if lane.parent is not None and lane.source.removeprefix("analyzer:") in affected
                ]
                for lane in derived:
                    lane.stale = True
                    session.mark_derived_stale(lane.id)
            return True, bool(derived)

    async def refresh():
        changed, stale = await run_in_threadpool(refresh_plugins)
        if changed:
            await connections.broadcast({"type": "plugins_changed"})
            if stale:
                await connections.broadcast()

    @app.get("/api/analyzers")
    async def list_analyzers():
        await refresh()
        return registry.metadata()

    def execute(identifier: str, body: RunRequest):
        with heavy:
            with session.cache_lock, registry.lock, session.lock:
                entry = registry.analyzers.get(identifier)
                if entry is None:
                    raise HTTPException(404, "Analyzer not found")
                lane = find(body.lane)
                if entry.input != lane.kind:
                    raise HTTPException(422, f"Analyzer requires a {entry.input} lane")
                try:
                    params = entry.arguments(body.params)
                except ValueError as exc:
                    raise HTTPException(422, str(exc)) from exc
                first, last, origin = slice_bounds(lane, body)
                if first == last:
                    raise HTTPException(422, "Selection contains no analyzer input")
                channel = slice(None)
                if body.channel is not None:
                    if body.channel >= lane.data.shape[0]:
                        raise HTTPException(422, "Invalid channel")
                    channel = slice(body.channel, body.channel + 1)
                # Canonical lane-local bounds keep cache keys correct when the source is moved.
                key = (
                    lane.id,
                    lane.version,
                    entry.id,
                    entry.version,
                    tuple(params.items()),
                    first,
                    last,
                    body.channel,
                )
                result = registry.results.get(key)
                if result is not None:
                    return result_response(result, lane, origin, entry, session)
                generation = session.cache_generation
                x, sr = lane.data[channel, first:last].clone(), lane.sr
                if lane.kind == "feature":
                    params |= {
                        "frame_rate": lane.frame_rate,
                        "freq_axis": deepcopy(lane.freq_axis),
                        "value_scale": lane.value_scale,
                    }

            result = normalize_result(entry.function(x, sr, **params), sr)
            with session.cache_lock, registry.lock, session.lock:
                current = find(body.lane)
                if current.version != key[1] or registry.analyzers.get(identifier) is not entry:
                    raise HTTPException(409, "Analyzer or input changed. Run again.")
                response = result_response(result, current, origin, entry, session)
                if generation == session.cache_generation:
                    registry.results[key] = result
                return response

    @app.post("/api/analyzers/{identifier}/run")
    async def run_analyzer(identifier: str, body: RunRequest):
        await refresh()
        response = await run_in_threadpool(execute, identifier, body)
        if isinstance(response, dict) and response["lanes"]:
            await connections.broadcast()
        return response

    @app.get("/api/lanes/{lane_id}/data")
    def lane_data(lane_id: str):
        with session.lock:
            lane = find(lane_id)
            if lane.kind == "curve":
                return framed(
                    {"times": lane.times.numpy(), "values": lane.values.numpy()},
                    {"unit": lane.unit, "y_scale": lane.y_scale, "labels": lane.labels},
                )
            if lane.kind == "events":
                return {"items": lane.items}
        raise HTTPException(422, "Data readback requires a curve or events lane")
