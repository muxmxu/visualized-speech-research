"""Authenticated local HTTP and WebSocket application."""

import math
import re
import secrets
import traceback
from asyncio import TimerHandle, get_running_loop
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from pickle import UnpicklingError
from threading import BoundedSemaphore
from time import monotonic
from typing import Literal
from uuid import uuid4
from zipfile import BadZipFile

import numpy as np
from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field, FiniteFloat, TypeAdapter, model_validator
from scipy.signal import get_window, resample_poly
from starlette.exceptions import HTTPException as StarletteHTTPException

import vsr.api as api
from vsr.analyzers.registry import Registry
from vsr.config import home, load_config
from vsr.device import select_device
from vsr.dsp.edit import masked_interval
from vsr.dsp.spectrum import NoEligibleFrames, spectrum
from vsr.dsp.waveform import waveform
from vsr.frame import decode_frame, encode_frame
from vsr.io.audio import AUDIO_EXTENSIONS, read_audio
from vsr.io.tensors import (
    TENSOR_EXTENSIONS,
    Interpretation,
    KeyPath,
    PositiveInt,
    TensorInputError,
    interpret_tensor,
    load_tensors,
    tensor_leaf,
    tensor_tree,
)
from vsr.presets import preset_definitions, resolve_preset
from vsr.server.routes_analyzers import register_analyzers
from vsr.server.routes_datasets import register_datasets
from vsr.server.routes_edit import register_edit
from vsr.server.routes_record import register_record
from vsr.server.routes_spectrogram import register_spectrogram
from vsr.server.session import Lane, Session
from vsr.server.ws import Connections

_heavy_compute = BoundedSemaphore(1)
_interpretation = TypeAdapter(Interpretation)
OPEN_LAUNCH_HEADER = "X-VSR-Open-Launch"
_launch_id_pattern = re.compile(r"[A-Za-z0-9_-]{43}")
_launch_lifetime = 300
_launch_limit = 64


@dataclass
class PendingOpen:
    paths: list[Path]
    deadline: float
    timer: TimerHandle | None = None


class OpenRequest(BaseModel):
    paths: list[str]


class OpenTensorRequest(BaseModel):
    path: str
    key_path: KeyPath
    interpretation: Interpretation


class PushHeader(BaseModel):
    name: str
    kind: Literal["audio", "feature"]
    sr: PositiveInt
    interpretation: dict


class LanePatch(BaseModel):
    name: str | None = None
    offset: FiniteFloat | None = None
    gain_db: FiniteFloat | None = None
    mute: bool | None = None
    solo: bool | None = None


class ReorderRequest(BaseModel):
    ids: list[str]


class SettingsRequest(BaseModel):
    compute_device: str = Field(pattern=r"^(auto|cpu|cuda(:[0-9]+)?|mps)$")


class SpectrumRequest(BaseModel):
    t0: FiniteFloat
    t1: FiniteFloat
    channel: int = Field(ge=0)
    method: Literal["frame", "welch", "full"]
    n_fft: int = Field(gt=0)
    win_length: int = Field(gt=0)
    hop: int = Field(gt=0)
    window: Literal["hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian", "boxcar"]
    window_param: FiniteFloat
    stats: list[Literal["mean", "median", "p10", "p90", "max"]] = Field(min_length=1)
    unit: Literal["dbfs", "db_per_hz"]
    active_only: bool

    @model_validator(mode="after")
    def validate_parameters(self):
        if self.t1 <= self.t0 or self.win_length > self.n_fft:
            raise ValueError("Invalid interval or transform parameters")
        if self.window == "boxcar" and self.method != "full":
            raise ValueError("Boxcar is only available for full spectrum")
        if self.window == "gaussian" and self.window_param <= 0:
            raise ValueError("Gaussian parameter must be positive")
        return self


def audio_lane(path: Path, upload_name: str | None = None) -> Lane:
    data, sr = read_audio(path)
    return Lane(
        name=upload_name or path.name,
        source=f"upload:{upload_name}" if upload_name else str(path),
        data=data,
        sr=sr,
    )


def create_app(
    token: str,
    device: str = "auto",
    paths: list[str] | None = None,
    *,
    launch_id: str | None = None,
) -> FastAPI:
    pending_opens: dict[str, PendingOpen] = {}

    def register_open(identifier: str, raw_paths: list[str]) -> PendingOpen:
        paths = [Path(raw) for raw in raw_paths]
        if not all(path.is_absolute() for path in paths) or not any(
            path.suffix.lower() in TENSOR_EXTENSIONS for path in paths
        ):
            raise HTTPException(422, "A launch requires absolute paths including a tensor file")
        if len(pending_opens) >= _launch_limit:
            raise HTTPException(429, "Too many pending opens")
        launch = PendingOpen(paths, monotonic() + _launch_lifetime)
        pending_opens[identifier] = launch
        return launch

    def arm_open(identifier: str, launch: PendingOpen) -> None:
        launch.timer = get_running_loop().call_later(
            max(0, launch.deadline - monotonic()), pending_opens.pop, identifier
        )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        for identifier in pending_opens:
            arm_open(identifier, pending_opens[identifier])
        try:
            await run_in_threadpool(analyzers.refresh)
            async with recording.lifespan(), datasets.lifespan():
                yield
        finally:
            for launch in pending_opens.values():
                if launch.timer is not None:
                    launch.timer.cancel()
            pending_opens.clear()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
    config = load_config()
    analyzers = Registry(config["plugin_dirs"])
    cache_bytes = config["cache_bytes"]
    session = Session(history_budget=cache_bytes)
    app.state.session = session
    if launch_id is not None:
        register_open(launch_id, paths or [])
    else:
        for raw in paths or []:
            path = Path(raw).expanduser().resolve()
            if path.suffix.lower() not in AUDIO_EXTENSIONS:
                raise ValueError(f"Unsupported audio file: {path.name}")
            session.lanes.append(audio_lane(path))
    connections = Connections()
    app.state.settings = select_device(device)
    api._device = app.state.settings["compute_device"]

    @app.middleware("http")
    async def authenticate(request: Request, call_next):
        if (
            request.url.path == "/api" or request.url.path.startswith("/api/")
        ) and request.headers.get("Authorization") != f"Bearer {token}":
            return JSONResponse(
                {"error": "Unauthorized", "detail": "Invalid or missing token", "traceback": None},
                status_code=401,
            )
        return await call_next(request)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(
            {"error": "HTTP error", "detail": str(exc.detail), "traceback": None},
            status_code=exc.status_code,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(
            {"error": "Validation error", "detail": str(exc), "traceback": None}, status_code=422
        )

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        return JSONResponse(
            {
                "error": type(exc).__name__,
                "detail": str(exc),
                "traceback": "".join(traceback.format_exception(exc)),
            },
            status_code=500,
        )

    def find(lane_id: str) -> Lane:
        for lane in session.lanes:
            if lane.id == lane_id:
                return lane
        raise HTTPException(404, "Lane not found")

    def find_audio(lane_id: str) -> Lane:
        lane = find(lane_id)
        if lane.kind != "audio":
            raise HTTPException(422, "This route requires an audio lane")
        return lane

    async def publish_lanes(lanes: list[Lane]) -> dict:
        with session.lock:
            session.lanes.extend(lanes)
            metadata = [lane.metadata() for lane in lanes]
        await connections.broadcast()
        return {"lanes": metadata}

    def read_tensor_file(path: Path):
        if path.suffix.lower() not in TENSOR_EXTENSIONS:
            raise HTTPException(400, f"Unsupported tensor file: {path.name}")
        try:
            return load_tensors(path)
        except UnpicklingError as exc:
            raise HTTPException(422, "Tensor file rejected by safe weights-only loading") from exc
        except (OSError, ValueError, RuntimeError, EOFError, BadZipFile) as exc:
            raise HTTPException(422, str(exc)) from exc

    def inspect_tensor(path: Path) -> dict:
        try:
            tree = tensor_tree(read_tensor_file(path))
        except TensorInputError as exc:
            raise HTTPException(422, str(exc)) from exc
        if not tree:
            raise HTTPException(422, "File contains no tensor leaves")
        return {"needs_interpretation": True, "path": str(path), "tree": tree}

    async def add_tensor(value, interpretation, name, source):
        try:
            data, fields = interpret_tensor(value, interpretation)
        except TensorInputError as exc:
            raise HTTPException(422, str(exc)) from exc
        lanes = [
            Lane(
                name=name if len(data) == 1 else f"{name} [{index}]",
                source=source,
                data=item,
                **fields,
            )
            for index, item in enumerate(data)
        ]
        return await publish_lanes(lanes)

    def read_open_audio(path: Path, upload_name: str | None = None) -> Lane:
        if path.suffix.lower() not in AUDIO_EXTENSIONS:
            raise HTTPException(400, f"Unsupported audio file: {path.name}")
        return audio_lane(path, upload_name)

    async def open_paths(paths: list[str], upload_name: str | None = None) -> dict:
        lanes = [read_open_audio(Path(raw).expanduser().resolve(), upload_name) for raw in paths]
        return await publish_lanes(lanes)

    async def claim_open(identifier: str) -> dict:
        launch = pending_opens.pop(identifier, None)
        if launch is None:
            raise HTTPException(404, "Launch not found")
        if launch.timer is not None:
            launch.timer.cancel()
        if monotonic() >= launch.deadline:
            raise HTTPException(404, "Launch not found")
        if len(launch.paths) == 1:
            return inspect_tensor(launch.paths[0])
        lanes, interpretations = [], []
        for path in launch.paths:
            if path.suffix.lower() in TENSOR_EXTENSIONS:
                interpretations.append(inspect_tensor(path))
            else:
                lanes.append(read_open_audio(path))
        publication = await publish_lanes(lanes) if lanes else {"lanes": []}
        return publication | {"interpretations": interpretations}

    @app.get("/api/ping")
    async def ping():
        return {"ok": True}

    @app.get("/api/session")
    async def get_session():
        with session.lock:
            return {"lanes": [lane.metadata() for lane in session.lanes]}

    @app.get("/api/fs/list")
    async def list_files(path: str = "~"):
        directory = Path(path).expanduser().resolve()
        items = []
        for item in sorted(directory.iterdir()):
            if item.is_dir() or item.suffix.lower() in AUDIO_EXTENSIONS | TENSOR_EXTENSIONS:
                stat = item.stat()
                items.append(
                    {
                        "name": item.name,
                        "is_dir": item.is_dir(),
                        "size": stat.st_size,
                        "mtime": stat.st_mtime,
                    }
                )
        return {"path": str(directory), "entries": items}

    @app.post("/api/open")
    async def open_files(body: OpenRequest, request: Request):
        headers = request.headers.getlist(OPEN_LAUNCH_HEADER)
        if headers:
            if len(headers) != 1:
                raise HTTPException(422, "Use exactly one launch header")
            [identifier] = headers
            if identifier == "stage":
                identifier = secrets.token_urlsafe(32)
                arm_open(identifier, register_open(identifier, body.paths))
                result = {"launch_id": identifier}
            else:
                if body.paths or not _launch_id_pattern.fullmatch(identifier):
                    raise HTTPException(422, "A claim requires a valid launch ID and empty paths")
                result = await claim_open(identifier)
            return JSONResponse(result, headers={"Cache-Control": "no-store"})
        if len(body.paths) == 1:
            path = Path(body.paths[0]).expanduser().resolve()
            if path.suffix.lower() in TENSOR_EXTENSIONS:
                return inspect_tensor(path)
        return await open_paths(body.paths)

    @app.post("/api/open_tensor")
    async def open_tensor(body: OpenTensorRequest):
        path = Path(body.path).expanduser().resolve()
        try:
            value = tensor_leaf(read_tensor_file(path), body.key_path)
        except TensorInputError as exc:
            raise HTTPException(422, str(exc)) from exc
        source = (
            f"upload:{path.name}"
            if path.is_relative_to((home() / "uploads").resolve())
            else str(path)
        )
        return await add_tensor(value, body.interpretation, path.name, source)

    @app.post("/api/push")
    async def push(request: Request):
        try:
            value, meta = decode_frame(await request.body())
            header = PushHeader.model_validate(meta)
            interpretation = _interpretation.validate_python(
                header.interpretation | {"kind": header.kind, "sr": header.sr}
            )
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if not isinstance(value, np.ndarray):
            raise HTTPException(422, "Push requires exactly one framed array")
        return await add_tensor(value, interpretation, header.name, f"push:{header.name}")

    @app.post("/api/upload")
    async def upload(request: Request, name: str):
        if Path(name).name != name or name in {"", ".", ".."}:
            raise HTTPException(400, "Invalid upload name")
        path = home() / "uploads" / uuid4().hex / name
        path.parent.mkdir(parents=True)
        path.write_bytes(await request.body())
        if path.suffix.lower() in TENSOR_EXTENSIONS:
            return inspect_tensor(path.resolve())
        return await open_paths([str(path)], name)

    @app.post("/api/lanes/reorder")
    async def reorder(body: ReorderRequest):
        with session.lock:
            if len(body.ids) != len(session.lanes) or set(body.ids) != {
                lane.id for lane in session.lanes
            }:
                raise HTTPException(400, "IDs must contain every lane exactly once")
            session.lanes = [find(lane_id) for lane_id in body.ids]
        await connections.broadcast()
        return {"ok": True}

    @app.patch("/api/lanes/{lane_id}")
    async def patch_lane(lane_id: str, body: LanePatch):
        with session.lock:
            lane = find(lane_id)
            changes = body.model_dump(exclude_unset=True, exclude_none=True)
            if "offset" in changes:
                session.set_offset(lane, changes.pop("offset"))
            for key, value in changes.items():
                setattr(lane, key, value)
            result = lane.metadata()
        await connections.broadcast()
        return result

    @app.delete("/api/lanes/{lane_id}")
    async def delete_lane(lane_id: str):
        with session.lock:
            find(lane_id)
            for removed in session.remove_lanes({lane_id}):
                session.forget_closed_lane(removed)
        await connections.broadcast()
        return {"ok": True}

    @app.get("/api/lanes/{lane_id}/waveform")
    async def get_waveform(
        lane_id: str,
        t0: FiniteFloat,
        t1: FiniteFloat,
        width: int = 1000,
        channel: int | None = None,
    ):
        if t1 <= t0 or width <= 0:
            raise HTTPException(422, "Invalid viewport")
        with session.lock:
            lane = find_audio(lane_id)
            data = lane.data.numpy()
            if channel is not None:
                if channel < 0 or channel >= data.shape[0]:
                    raise HTTPException(422, "Invalid channel")
                data = data[channel : channel + 1]
            result, meta = waveform(data, lane.sr, t0 - lane.offset, t1 - lane.offset, width)
            meta["t0"] += lane.offset
            meta["t1"] += lane.offset
        return Response(
            encode_frame(result, meta),
            media_type="application/octet-stream",
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/api/lanes/{lane_id}/pcm")
    def get_pcm(
        lane_id: str,
        t0: FiniteFloat,
        t1: FiniteFloat,
        sr: int,
        channel: int | None = None,
        selection_t0: FiniteFloat | None = None,
        selection_t1: FiniteFloat | None = None,
        f_lo: FiniteFloat | None = None,
        f_hi: FiniteFloat | None = None,
        n_fft: int | None = None,
        win_length: int | None = None,
        window: Literal["hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian"]
        | None = None,
        window_param: FiniteFloat | None = None,
    ):
        if t1 <= t0 or sr <= 0:
            raise HTTPException(422, "Invalid interval or sample rate")
        fields = (selection_t0, selection_t1, f_lo, f_hi, n_fft, win_length, window, window_param)
        masked = any(value is not None for value in fields)
        if masked:
            if any(value is None for value in fields):
                raise HTTPException(422, "Incomplete mask parameters")
            if selection_t1 <= selection_t0 or f_hi <= f_lo or win_length < 4 or n_fft < win_length:
                raise HTTPException(422, "Invalid mask parameters")
            if (window == "gaussian" and window_param <= 0) or (
                window not in {"gaussian", "kaiser"} and window_param != 0
            ):
                raise HTTPException(422, "Invalid window parameter")
            window_spec = (
                (window, window_param * win_length if window == "gaussian" else window_param)
                if window in {"gaussian", "kaiser"}
                else window
            )
            w = np.asarray(get_window(window_spec, win_length, fftbins=True), dtype=np.float32)
            hop = win_length // 4
            if not np.isfinite(w).all():
                raise HTTPException(422, "Invalid effective window")
        with session.lock:
            lane = find_audio(lane_id)
            data = lane.data
            if channel is not None:
                if channel < 0 or channel >= data.shape[0]:
                    raise HTTPException(422, "Invalid channel")
                data = data[channel : channel + 1]
            source_sr, total, offset = lane.sr, data.shape[1], lane.offset
            output_length = (total * sr + source_sr - 1) // source_sr
            start = round(max(0, min(output_length, (t0 - offset) * sr)))
            end = max(start, round(max(0, min(output_length, (t1 - offset) * sr))))
            if start == end:
                source_start = source_end = 0
                output_offset = start
            elif sr != source_sr:
                divisor = math.gcd(sr, source_sr)
                up, down = sr // divisor, source_sr // divisor
                margin = (10 * max(up, down) + up - 1) // up + 2
                source_start = max(0, (start * down // up - margin) // down * down)
                source_end = min(total, (end * down + up - 1) // up + margin)
                output_offset = source_start * up // down
            else:
                source_start, source_end, output_offset = start, end, start
            if masked and start != end:
                q = n_fft // 2
                frames = 1 + (total + 2 * q - n_fft) // hop
                k0 = max(0, (source_start + q - n_fft) // hop + 1)
                k1 = min(frames, (source_end - 1 + q) // hop + 1)
                read_start = max(0, k0 * hop - q)
                read_end = min(total, (k1 - 1) * hop - q + n_fft)
            else:
                read_start, read_end = source_start, source_end
            data = data[:, read_start:read_end].clone()
        if masked and start != end:
            # Check the same squared overlap that ISTFT divides by, including lane edges.
            padded_window = np.pad(w, ((n_fft - win_length) // 2, (n_fft - win_length + 1) // 2))
            inverse_start = k0 * hop
            positions = np.concatenate(
                (
                    np.arange(inverse_start, min(source_end, inverse_start + n_fft)),
                    np.arange(max(inverse_start + n_fft, source_end - n_fft), source_end),
                )
            )
            overlap = np.zeros(positions.shape, dtype=np.float32)
            base = (positions + q) // hop
            for delta in range((n_fft + hop - 1) // hop + 1):
                frame = base - delta
                index = positions + q - frame * hop
                valid = (frame >= k0) & (frame < k1) & (index >= 0) & (index < n_fft)
                overlap[valid] += padded_window[index[valid]] ** 2
            if source_end - inverse_start > 2 * n_fft:
                periodic = np.array([np.sum(w[i::hop] ** 2) for i in range(hop)])
                minimum = min(np.min(overlap), np.min(periodic))
            else:
                minimum = np.min(overlap)
            if not np.isfinite(minimum) or minimum < 1e-11:
                raise HTTPException(422, "Invalid effective window")
            with _heavy_compute:
                data = masked_interval(
                    data,
                    total,
                    read_start,
                    source_start,
                    source_end,
                    source_sr,
                    n_fft,
                    win_length,
                    window,
                    window_param,
                    selection_t0 - offset,
                    selection_t1 - offset,
                    f_lo,
                    f_hi,
                    api.compute_device(),
                )
        else:
            data = data.numpy()
        if sr != source_sr and start != end:
            data = resample_poly(data, up, down, axis=1)
        result = np.ascontiguousarray(
            data[:, start - output_offset : end - output_offset], dtype=np.float32
        )
        return Response(
            encode_frame(result, {"sr": sr, "first_sample": start}),
            media_type="application/octet-stream",
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/api/presets")
    async def get_presets(sr: int = Query(gt=0)):
        return JSONResponse(
            {name: resolve_preset(name, sr) for name in preset_definitions()},
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/api/lanes/{lane_id}/spectrum")
    def get_spectrum(lane_id: str, body: SpectrumRequest):
        with session.lock:
            lane = find_audio(lane_id)
            if body.channel >= lane.data.shape[0]:
                raise HTTPException(422, "Invalid channel")
            t0 = body.t0 - lane.offset
            t1 = body.t1 - lane.offset
            start = max(0, round(t0 * lane.sr))
            end = min(lane.data.shape[-1], round(t1 * lane.sr))
            if body.method == "frame":
                if not 0 <= t0 < lane.data.shape[-1] / lane.sr:
                    raise HTTPException(422, "Frame center outside lane")
            elif end <= start or (body.method == "welch" and end - start < body.win_length):
                raise HTTPException(422, "Interval contains insufficient samples")
            if body.method == "full" and end - start > 2**24:
                raise HTTPException(422, "Full spectrum interval exceeds 2^24 samples")
            data = lane.data[body.channel : body.channel + 1].clone()
            sr = lane.sr
        params = body.model_dump(exclude={"channel", "t0", "t1"}) | {"t0": t0, "t1": t1}
        try:
            if body.method == "welch":
                # shortcut: calculations cannot be cancelled; add chunk cancellation when needed.
                with _heavy_compute:
                    values, freqs = spectrum(data, sr, **params)
            else:
                values, freqs = spectrum(data, sr, **params)
        except NoEligibleFrames as exc:
            raise HTTPException(422, str(exc)) from exc
        unit = {"frame": "dbfs", "full": "db", "welch": body.unit}[body.method]
        stats = body.stats if body.method == "welch" else [body.method]
        return Response(
            encode_frame(
                {"values": values[0].numpy(), "freqs": freqs.numpy()},
                {"unit": unit, "stats": stats},
            ),
            media_type="application/octet-stream",
            headers={"Cache-Control": "no-store"},
        )

    register_analyzers(app, session, find, connections, _heavy_compute, analyzers)
    register_edit(app, session, find_audio, _heavy_compute, connections)
    datasets = register_datasets(
        app, analyzers, session, connections, home() / "cache" / "datasets.sqlite"
    )
    recording = register_record(
        app, session, find_audio, connections, Path(config["recordings_dir"]).expanduser().resolve()
    )
    register_spectrogram(app, session, find, _heavy_compute, cache_bytes)

    @app.get("/api/settings")
    async def settings():
        return app.state.settings

    @app.post("/api/settings")
    def set_settings(body: SettingsRequest):
        with session.cache_lock:
            app.state.settings = select_device(body.compute_device)
            api._device = app.state.settings["compute_device"]
            session.cache.clear()
            session.cache_size = 0
            session.cache_generation += 1
            analyzers.clear_results()
        return app.state.settings

    @app.websocket("/ws")
    async def websocket(socket: WebSocket):
        if socket.query_params.get("token") != token:
            await socket.close(code=1008)
            return
        await socket.accept()
        try:
            async with recording.lock:
                state = recording.state()
                if state["state"] != "idle":
                    await socket.send_json(state)
                connections.clients.add(socket)
            while True:
                await socket.receive_text()
        except WebSocketDisconnect:
            connections.clients.discard(socket)

    web = Path(__file__).resolve().parents[1] / "web"

    @app.get("/{path:path}")
    async def static(path: str):
        target = (web / path).resolve()
        if not target.is_relative_to(web) or not target.is_file():
            target = web / "index.html"
        return FileResponse(target)

    return app
