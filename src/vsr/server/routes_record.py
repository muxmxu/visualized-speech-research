"""Recording controls and explicit mixdown at the authenticated HTTP boundary."""

import asyncio
import traceback
from contextlib import asynccontextmanager
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from typing import Annotated, Literal

import numpy as np
import soundfile as sf
import torch
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

from vsr.io.audio import SAVE_FORMATS, read_audio, write_audio
from vsr.record.devices import describe_devices, load_sounddevice
from vsr.record.mix import mix_audio, playback_output
from vsr.record.recorder import Capture, Meter, Take, Track, capture_click, monitor
from vsr.server.session import Lane

DeviceId = Annotated[int, Field(strict=True, ge=0)]
PositiveInt = Annotated[int, Field(strict=True, gt=0)]


class Mapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lane: str | None
    channels: list[Annotated[int, Field(strict=True, ge=0)]] = Field(min_length=1, max_length=2)

    @model_validator(mode="after")
    def validate_channels(self):
        if len(self.channels) == 2 and (
            self.lane is None or self.channels[1] != self.channels[0] + 1
        ):
            raise ValueError("Select one input channel or two consecutive channels for a lane")
        return self


class InputSettings(BaseModel):
    model_config = ConfigDict(extra="forbid")

    input_device: DeviceId | None
    sr: PositiveInt
    blocksize: PositiveInt


class ArmRequest(InputSettings):
    mapping: list[Mapping]


class StartRequest(ArmRequest):
    output_device: DeviceId | None = None
    subtype: Literal["FLOAT", "PCM_24", "PCM_16"]
    overdub: bool
    latency_ms: FiniteFloat | None = Field(ge=0)
    start_time: FiniteFloat


class CalibrationRequest(InputSettings):
    output_device: DeviceId | None


class MixdownRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    t0: FiniteFloat
    t1: FiniteFloat
    sr: PositiveInt
    path: str = Field(min_length=1)
    subtype: str = Field(min_length=1)


@dataclass
class InputDevice:
    sd: object
    id: int
    channels: int


@dataclass
class Armed:
    request: ArmRequest
    device: InputDevice


@dataclass
class ActiveTake:
    request: StartRequest
    writer: Take
    trim: int
    notice: str | None


def validated_devices(body, *, duplex: bool = False, calibration: bool = False):
    sd, reason = load_sounddevice()
    if sd is None:
        raise HTTPException(409, reason)
    options = describe_devices(sd, reason)

    def select(direction):
        requested = getattr(body, f"{direction}_device")
        device_id = options[f"default_{direction}"] if requested is None else requested
        devices = options["devices"]
        if device_id is None or device_id >= len(devices):
            raise HTTPException(422, f"No valid {direction} device selected")
        channels = devices[device_id][f"max_{direction}_channels"]
        if channels == 0:
            raise HTTPException(422, f"The selected device has no {direction} channels")
        return device_id, channels

    input_id, input_channels = select("input")
    if calibration:
        input_channels = 1
    output = None
    if duplex:
        output_id, capacity = select("output")
        output = (output_id, 1 if calibration else min(2, capacity))
    try:
        sd.check_input_settings(
            device=input_id, channels=input_channels, samplerate=body.sr, dtype="float32"
        )
        if output is not None:
            sd.check_output_settings(
                device=output[0], channels=output[1], samplerate=body.sr, dtype="float32"
            )
    except sd.PortAudioError as exc:
        raise HTTPException(422, str(exc)) from exc
    return InputDevice(sd, input_id, input_channels), output


class Recording:
    def __init__(self, session, find_audio, connections, directory: Path) -> None:
        self.session = session
        self.find_audio = find_audio
        self.connections = connections
        self.directory = directory
        self.lock = asyncio.Lock()
        self.events = asyncio.Queue()
        self.armed: Armed | None = None
        self.monitor: Capture | None = None
        self.take: ActiveTake | None = None

    @asynccontextmanager
    async def lifespan(self):
        self.loop = asyncio.get_running_loop()
        publisher = asyncio.create_task(self._publish())
        try:
            yield
        finally:
            try:
                async with self.lock:
                    if self.take is not None:
                        active, self.take = self.take, None
                        await run_in_threadpool(active.writer.capture.finish)
                    await self._close_monitor()
            finally:
                self.events.put_nowait(None)
                await publisher

    def state(self) -> dict:
        if self.take is not None:
            request = self.take.request
            state = "recording"
            mapping = request.mapping or [Mapping(lane=None, channels=[0])]
            start_time, notice = request.start_time, self.take.notice
        else:
            state = "idle" if self.armed is None else "armed"
            mapping = [] if self.armed is None else self.armed.request.mapping
            start_time = notice = None
        return {
            "type": "record_state",
            "state": state,
            "mapping": [target.model_dump() for target in mapping],
            "start_time": start_time,
            "notice": notice,
        }

    def _feedback(self, capture, event) -> None:
        self.loop.call_soon_threadsafe(self.events.put_nowait, (capture, event))

    def _watch(self, capture: Capture) -> None:
        def completed(result):
            if (error := result.exception()) is not None:
                self._feedback(capture, error)

        capture.result.add_done_callback(completed)

    async def _publish(self) -> None:
        while (item := await self.events.get()) is not None:
            capture, event = item
            async with self.lock:
                take = self.take
                if capture is not self.monitor and (
                    take is None or capture is not take.writer.capture
                ):
                    continue
                if isinstance(event, Exception):
                    await self._handle_failure(capture, event)
                elif isinstance(event, str):
                    take.notice = event
                    await self.connections.broadcast(self.state())
                else:
                    await self.connections.broadcast(event)

    async def _send_error(self, error: Exception) -> None:
        await self.connections.broadcast(
            {
                "type": "error",
                "error": type(error).__name__,
                "detail": str(error),
                "traceback": "".join(traceback.format_exception(error)),
            }
        )

    async def _handle_failure(self, capture: Capture, error: Exception) -> None:
        if capture is self.monitor:
            self.monitor = None
            self.armed = None
        else:
            self.take = None
        await self._send_error(error)
        try:
            await run_in_threadpool(capture.close)
            await self._open_monitor()
        except (OSError, RuntimeError, capture.portaudio_error) as exc:
            self.armed = None
            await self._send_error(exc)
        await self.connections.broadcast(self.state())

    def _tracks(self, mapping: list[Mapping], channels: int) -> list[Track]:
        targets = [item.lane for item in mapping if item.lane is not None]
        if len(set(targets)) != len(targets):
            raise HTTPException(422, "Each armed audio lane may have only one input mapping")
        tracks = []
        for item in mapping:
            if item.channels[-1] >= channels:
                raise HTTPException(422, "Input mapping exceeds the selected device's channels")
            name = (
                f"Input {item.channels[0] + 1}"
                if item.lane is None
                else self.find_audio(item.lane).name
            )
            tracks.append(Track(item.lane, name, item.channels))
        return tracks

    async def _open_capture(self, device, body, output=None) -> Capture:
        return await run_in_threadpool(
            Capture, device.sd, device.id, device.channels, body.sr, body.blocksize, output=output
        )

    async def _open_monitor(self) -> None:
        if self.armed is not None:
            request, device = self.armed.request, self.armed.device
            capture = await self._open_capture(device, request)
            meter = Meter(request.sr, device.channels, partial(self._feedback, capture))
            await run_in_threadpool(capture.start, partial(monitor, capture, meter))
            self.monitor = capture
            self._watch(capture)

    async def _close_monitor(self) -> None:
        if self.monitor is not None:
            capture, self.monitor = self.monitor, None
            await run_in_threadpool(capture.finish)

    async def arm(self, body: ArmRequest) -> dict:
        if self.take is not None:
            raise HTTPException(409, "Stop recording before changing the armed lanes")
        armed = None
        if body.mapping:
            device, _ = await run_in_threadpool(validated_devices, body)
            with self.session.lock:
                self._tracks(body.mapping, device.channels)
            armed = Armed(body, device)
        await self._close_monitor()
        self.armed = armed
        opened = False
        try:
            await self._open_monitor()
            opened = True
        finally:
            if not opened:
                self.armed = None
            await self.connections.broadcast(self.state())
        return self.state()

    def _overdub(self, body, tracks, channels) -> np.ndarray:
        excluded = frozenset(track.lane_id for track in tracks if track.lane_id is not None)
        with self.session.lock:
            lanes = [lane for lane in self.session.lanes if lane.kind == "audio"]
            mixed = mix_audio(lanes, round(body.start_time * body.sr), None, body.sr, excluded)
        return playback_output(mixed, channels)

    async def start(self, body: StartRequest) -> dict:
        if self.take is not None:
            raise HTTPException(409, "Already recording")
        device, sink = await run_in_threadpool(validated_devices, body, duplex=body.overdub)
        with self.session.lock:
            tracks = self._tracks(
                body.mapping or [Mapping(lane=None, channels=[0])], device.channels
            )

        output = notice = None
        if sink is not None:
            output_id, channels = sink
            output = (output_id, await run_in_threadpool(self._overdub, body, tracks, channels))
            if output_id != device.id:
                notice = "device_clock_drift"

        await self._close_monitor()
        try:
            capture = await self._open_capture(device, body, output)
            latency = 0.0
            if body.overdub:
                latency = body.latency_ms
                if latency is None:
                    latency = sum(capture.stream.latency) * 1000
            trim = round(latency * body.sr / 1000)
            send = partial(self._feedback, capture)
            meter = Meter(body.sr, device.channels, send)
            writer = Take(
                capture, meter, self.directory, body.subtype, body.sr, body.blocksize, tracks, send
            )
            await run_in_threadpool(capture.start, writer.write)
            self.take = ActiveTake(body, writer, trim, notice)
            self._watch(capture)
        finally:
            if self.take is None:
                await self._restore_arm()
        state = self.state()
        await self.connections.broadcast(state)
        return state

    async def _restore_arm(self) -> None:
        opened = False
        try:
            await self._open_monitor()
            opened = True
        finally:
            if not opened:
                self.armed = None

    def _finish_take(self, take: ActiveTake) -> list[dict]:
        recorded = take.writer.capture.finish()
        loaded = []
        for result in recorded:
            data, sr = read_audio(result.path)
            track = result.track
            loaded.append(
                (
                    track.lane_id,
                    Lane(
                        track.name,
                        f"record:{result.path}",
                        data[:, take.trim :],
                        sr,
                        offset=take.request.start_time,
                        record_warnings=take.writer.warnings.copy(),
                    ),
                )
            )
        with self.session.lock:
            replacements, created, result = [], [], []
            for lane_id, take_lane in loaded:
                if lane_id is None:
                    created.append(take_lane)
                    result.append(take_lane)
                else:
                    lane = self.find_audio(lane_id)
                    replacements.append((lane, take_lane))
                    result.append(lane)
            self.session.record_take(replacements, created)
            return [lane.metadata() for lane in result]

    async def stop(self) -> dict:
        if self.take is None:
            raise HTTPException(409, "No recording is in progress")
        take, self.take = self.take, None
        try:
            lanes = await run_in_threadpool(self._finish_take, take)
            await self.connections.broadcast()
        finally:
            try:
                await self._restore_arm()
            finally:
                await self.connections.broadcast(self.state())
        return {"lanes": lanes}

    async def calibrate(self, body: CalibrationRequest) -> dict:
        if self.take is not None:
            raise HTTPException(409, "Stop recording before calibrating")
        device, sink = await run_in_threadpool(
            validated_devices, body, duplex=True, calibration=True
        )
        output_id, channels = sink
        click = np.array([0.5], dtype=np.float32)
        await self._close_monitor()
        try:
            capture = await self._open_capture(
                device, body, (output_id, click.reshape(-1, channels))
            )
            consume = partial(capture_click, capture, click, body.sr)
            await run_in_threadpool(capture.start, consume)
            return {"latency_ms": await run_in_threadpool(capture.finish_after_result)}
        finally:
            await self._restore_arm()

    def mixdown(self, body: MixdownRequest) -> dict:
        first, last = round(body.t0 * body.sr), round(body.t1 * body.sr)
        if last <= first:
            raise HTTPException(422, "Select an increasing interval containing audio samples")
        path = Path(body.path).expanduser().resolve()
        format = SAVE_FORMATS.get(path.suffix.lower())
        if format is None or not sf.check_format(format, body.subtype):
            raise HTTPException(400, "Choose a WAV or FLAC path and a supported subtype.")
        with self.session.lock:
            lanes = [lane for lane in self.session.lanes if lane.kind == "audio"]
            for lane in lanes:
                source = Path(lane.source.removeprefix("record:"))
                if source.is_absolute() and source.resolve() == path:
                    raise HTTPException(
                        400, "Mixdown requires a path different from the source audio."
                    )
            mixed = mix_audio(lanes, first, last, body.sr)
            write_audio(path, torch.from_numpy(mixed), body.sr, format, body.subtype)
        return {"path": str(path), "clipping": bool(np.max(np.abs(mixed)) > 1)}


def register_record(app, session, find_audio, connections, directory: Path) -> Recording:
    recording = Recording(session, find_audio, connections, directory)

    @app.get("/api/audio/devices")
    def devices():
        return describe_devices(*load_sounddevice())

    @app.post("/api/record/arm")
    async def arm(body: ArmRequest):
        async with recording.lock:
            return await recording.arm(body)

    @app.post("/api/record/start")
    async def start(body: StartRequest):
        async with recording.lock:
            return await recording.start(body)

    @app.post("/api/record/stop")
    async def stop():
        async with recording.lock:
            return await recording.stop()

    @app.post("/api/record/calibrate")
    async def calibrate(body: CalibrationRequest):
        async with recording.lock:
            return await recording.calibrate(body)

    @app.post("/api/mixdown")
    def mixdown(body: MixdownRequest):
        return recording.mixdown(body)

    return recording
