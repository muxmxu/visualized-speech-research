"""Authenticated local HTTP and WebSocket application."""

import math
import traceback
from pathlib import Path
from uuid import uuid4

import numpy as np
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel, Field, FiniteFloat
from scipy.signal import resample_poly
from starlette.exceptions import HTTPException as StarletteHTTPException

import vsr.api as api
from vsr.config import home
from vsr.device import select_device
from vsr.dsp.waveform import waveform
from vsr.frame import encode_frame
from vsr.io.audio import AUDIO_EXTENSIONS, read_audio
from vsr.server.session import Lane, Session
from vsr.server.ws import Connections


class OpenRequest(BaseModel):
    paths: list[str]


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


def create_app(token: str, device: str = "auto", paths: list[str] | None = None) -> FastAPI:
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    session = Session()
    for raw in paths or []:
        path = Path(raw).expanduser().resolve()
        if path.suffix.lower() not in AUDIO_EXTENSIONS:
            raise ValueError(f"Unsupported audio file: {path.name}")
        data, sr = read_audio(path)
        session.lanes.append(Lane(name=path.name, source=str(path), data=data, sr=sr))
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

    async def open_paths(paths: list[str], upload_name: str | None = None) -> list[dict]:
        lanes = []
        for raw in paths:
            path = Path(raw).expanduser().resolve()
            if path.suffix.lower() not in AUDIO_EXTENSIONS:
                raise HTTPException(400, f"Unsupported audio file: {path.name}")
            data, sr = read_audio(path)
            lanes.append(
                Lane(
                    name=upload_name or path.name,
                    source=f"upload:{upload_name}" if upload_name else str(path),
                    data=data,
                    sr=sr,
                )
            )
        with session.lock:
            session.lanes.extend(lanes)
        await connections.broadcast()
        return [lane.metadata() for lane in lanes]

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
            if item.is_dir() or item.suffix.lower() in AUDIO_EXTENSIONS:
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
    async def open_files(body: OpenRequest):
        return {"lanes": await open_paths(body.paths)}

    @app.post("/api/upload")
    async def upload(request: Request, name: str):
        if Path(name).name != name or name in {"", ".", ".."}:
            raise HTTPException(400, "Invalid upload name")
        path = home() / "uploads" / uuid4().hex / name
        path.parent.mkdir(parents=True)
        path.write_bytes(await request.body())
        return {"lanes": await open_paths([str(path)], name)}

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
            for key, value in body.model_dump(exclude_unset=True, exclude_none=True).items():
                setattr(lane, key, value)
            result = lane.metadata()
        await connections.broadcast()
        return result

    @app.delete("/api/lanes/{lane_id}")
    async def delete_lane(lane_id: str):
        with session.lock:
            session.lanes.remove(find(lane_id))
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
            lane = find(lane_id)
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
    async def get_pcm(
        lane_id: str, t0: FiniteFloat, t1: FiniteFloat, sr: int, channel: int | None = None
    ):
        if t1 <= t0 or sr <= 0:
            raise HTTPException(422, "Invalid interval or sample rate")
        with session.lock:
            lane = find(lane_id)
            data = lane.data.numpy()
            if channel is not None:
                if channel < 0 or channel >= data.shape[0]:
                    raise HTTPException(422, "Invalid channel")
                data = data[channel : channel + 1]
            output_length = (data.shape[1] * sr + lane.sr - 1) // lane.sr
            start = max(0, min(output_length, round((t0 - lane.offset) * sr)))
            end = max(start, min(output_length, round((t1 - lane.offset) * sr)))
            if end == start:
                data = data[:, :0]
                start_in_data, end_in_data = 0, 0
            elif sr != lane.sr:
                divisor = math.gcd(sr, lane.sr)
                up, down = sr // divisor, lane.sr // divisor
                margin = math.ceil(10 * max(up, down) / up) + 2
                source_start = max(0, (start * down // up - margin) // down * down)
                source_end = min(data.shape[1], math.ceil(end * down / up) + margin)
                data = resample_poly(data[:, source_start:source_end], up, down, axis=1)
                output_offset = source_start * up // down
                start_in_data, end_in_data = start - output_offset, end - output_offset
            else:
                start_in_data, end_in_data = start, end
            result = np.ascontiguousarray(data[:, start_in_data:end_in_data], dtype=np.float32)
        return Response(
            encode_frame(result, {"sr": sr, "first_sample": start}),
            media_type="application/octet-stream",
            headers={"Cache-Control": "no-store"},
        )

    @app.get("/api/settings")
    async def settings():
        return app.state.settings

    @app.post("/api/settings")
    async def set_settings(body: SettingsRequest):
        app.state.settings = select_device(body.compute_device)
        api._device = app.state.settings["compute_device"]
        return app.state.settings

    @app.websocket("/ws")
    async def websocket(socket: WebSocket):
        if socket.query_params.get("token") != token:
            await socket.close(code=1008)
            return
        await socket.accept()
        connections.clients.append(socket)
        try:
            while True:
                await socket.receive_text()
        except WebSocketDisconnect:
            connections.clients.remove(socket)

    web = Path(__file__).resolve().parents[1] / "web"

    @app.get("/{path:path}")
    async def static(path: str):
        target = (web / path).resolve()
        if not target.is_relative_to(web) or not target.is_file():
            target = web / "index.html"
        return FileResponse(target)

    return app
