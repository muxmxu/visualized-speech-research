"""Authenticated RIR analysis, sweep preview and simultaneous ESS capture."""

import json
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from queue import SimpleQueue
from typing import Literal

import numpy as np
import soundfile as sf
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

from vsr.dsp.sweep import deconvolve, exponential_sweep
from vsr.io.audio import read_audio, write_audio
from vsr.server.routes_record import (
    DeviceId,
    PositiveInt,
    available_devices,
    check_device_settings,
    select_device,
)
from vsr.server.session import Lane


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lane: str
    channel: DeviceId
    bands: list[Literal[125, 250, 500, 1000, 2000, 4000, 8000]] | None = None
    use_lundeby: bool = True
    truncation_s: FiniteFloat | None = Field(default=None, gt=0)


class PreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    output_device: DeviceId | None = None
    output_channel: DeviceId
    sr: PositiveInt
    f1_hz: FiniteFloat = Field(default=20, gt=0)
    f2_hz: FiniteFloat | None = Field(default=None, gt=0)

    @model_validator(mode="after")
    def validate_frequencies(self):
        if self.f2_hz is None:
            self.f2_hz = min(20_000, 0.95 * self.sr / 2)
        if not self.f1_hz < self.f2_hz < self.sr / 2:
            raise ValueError("Sweep frequencies must increase and stay below Nyquist")
        return self


class MeasureRequest(PreviewRequest):
    input_device: DeviceId | None = None
    input_channels: list[DeviceId] = Field(min_length=1)
    loopback_channel: DeviceId | None = None
    duration_s: FiniteFloat = Field(default=5, gt=0)
    amplitude_dbfs: FiniteFloat = Field(default=-12, le=0)
    fade_in_s: FiniteFloat = Field(default=0.05, ge=0)
    fade_out_s: FiniteFloat = Field(default=0.01, ge=0)
    pre_silence_s: FiniteFloat = Field(default=0.5, ge=0)
    tail_silence_s: FiniteFloat = Field(default=3, ge=0)
    repeats: PositiveInt = 1
    ir_length_s: FiniteFloat = Field(default=1, gt=0)
    confirm_loud: bool = False

    @model_validator(mode="after")
    def validate_measurement(self):
        if self.amplitude_dbfs > -6 and not self.confirm_loud:
            raise ValueError(
                "Sweeps above −6 dBFS can damage hearing. Confirm the level to proceed."
            )
        if len(set(self.input_channels)) != len(self.input_channels):
            raise ValueError("Select each input channel once")
        if all(channel == self.loopback_channel for channel in self.input_channels):
            raise ValueError("Select at least one acoustic input channel besides loopback")
        sweep = round(self.duration_s * self.sr)
        fades = round(self.fade_in_s * self.sr) + round(self.fade_out_s * self.sr)
        if sweep < 2 or fades > sweep:
            raise ValueError("Sweep duration must contain at least two samples and both fades")
        recording = (
            sweep + round(self.pre_silence_s * self.sr) + round(self.tail_silence_s * self.sr)
        )
        if not 1 <= round(self.ir_length_s * self.sr) <= recording:
            raise ValueError("IR length must cover at least one sample within the full recording")
        return self


class RecordingBuffer(np.ndarray):
    def __new__(cls, frames: int, channels: int, blocks: SimpleQueue):
        capture = np.empty((frames, channels), dtype=np.float32).view(cls)
        capture.blocks = blocks
        capture.completed_rows = 0
        return capture

    def __setitem__(self, key, values):
        super().__setitem__(key, values)
        rows, column = key
        # sounddevice 0.5.6 fills each chunk in ascending destination-column order.
        # Completed rows are never changed again, so the writer can use their view.
        if column == self.shape[1] - 1 and rows.start < rows.stop:
            self.blocks.put(self[rows].view(np.ndarray))
            self.completed_rows = rows.stop


def write_raw(path: Path, sr: int, channels: int, blocks: SimpleQueue, ready: Future) -> None:
    with sf.SoundFile(path, mode="x", samplerate=sr, channels=channels, subtype="FLOAT") as wav:
        ready.set_result(None)
        while (rows := blocks.get()) is not None:
            wav.write(rows)


def record_sweep(sd, playback, sr, devices, channels, path) -> list[str]:
    blocks = SimpleQueue()
    out = RecordingBuffer(len(playback), len(channels), blocks)
    ready = Future()

    def check_ready(result):
        if not ready.done():
            ready.set_exception(result.exception())

    with ThreadPoolExecutor(max_workers=1, thread_name_prefix="vsr-rir") as writer:
        result = writer.submit(write_raw, path, sr, len(channels), blocks, ready)
        result.add_done_callback(check_ready)
        ready.result()
        try:
            sd.playrec(
                playback,
                samplerate=sr,
                out=out,
                input_mapping=[channel + 1 for channel in channels],
                device=devices,
                blocking=True,
            )
            status = sd.get_status()
        finally:
            blocks.put(None)
            result.result()
    flags = [
        flag
        for flag, happened in (
            ("input overflow", status.input_overflow),
            ("input underflow", status.input_underflow),
            ("output overflow", status.output_overflow),
            ("output underflow", status.output_underflow),
        )
        if happened
    ]
    if out.completed_rows != len(out):
        flags.append("capture ended before the sweep completed")
    return flags


def output_settings(sd, options, body):
    device_id, capacity = select_device(options, "output", body.output_device)
    if body.output_channel >= capacity:
        raise HTTPException(422, "Requested output channel exceeds the selected device's channels")
    # Open at least two outputs when available to avoid mono duplication on some host APIs.
    channels = max(min(2, capacity), body.output_channel + 1)
    check_device_settings(sd, "output", device_id, channels, body.sr)
    return device_id, channels


def playback_channels(sweep, selected, channels):
    playback = np.zeros((len(sweep), channels), dtype=np.float32)
    playback[:, selected] = sweep
    return playback


def play_preview(body: PreviewRequest) -> None:
    sd, options = available_devices()
    output_id, channels = output_settings(sd, options, body)
    sweep = exponential_sweep(
        body.sr, body.f1_hz, body.f2_hz, 1, -30, round(0.05 * body.sr), round(0.01 * body.sr), 0, 0
    )
    sd.play(
        playback_channels(sweep, body.output_channel, channels),
        samplerate=body.sr,
        device=output_id,
        blocking=True,
    )


def capture_measurement(body: MeasureRequest, directory: Path):
    sd, options = available_devices()
    output_id, output_channels = output_settings(sd, options, body)
    input_id, capacity = select_device(options, "input", body.input_device)
    inputs = body.input_channels.copy()
    loopback = body.loopback_channel
    if loopback is not None and loopback not in inputs:
        inputs.append(loopback)
    loopback_index = None if loopback is None else inputs.index(loopback)
    input_channels = max(inputs) + 1
    if input_channels > capacity:
        raise HTTPException(422, "Requested input channel exceeds the selected device's channels")
    sr = body.sr
    check_device_settings(sd, "input", input_id, input_channels, sr)

    sweep = exponential_sweep(
        sr,
        body.f1_hz,
        body.f2_hz,
        body.duration_s,
        body.amplitude_dbfs,
        round(body.fade_in_s * sr),
        round(body.fade_out_s * sr),
        round(body.pre_silence_s * sr),
        round(body.tail_silence_s * sr),
    )
    if not np.any(sweep):
        raise HTTPException(422, "Sweep settings must produce a nonzero signal")
    playback = playback_channels(sweep, body.output_channel, output_channels)
    timestamp = datetime.now().astimezone()
    directory = directory / "rir" / timestamp.strftime("%Y%m%dT%H%M%S%f")
    directory.mkdir(parents=True)
    raw_paths = [directory / f"raw_{take}.wav" for take in range(1, body.repeats + 1)]
    warnings = []
    for path in raw_paths:
        flags = record_sweep(sd, playback, sr, (input_id, output_id), inputs, path)
        warnings.extend(f"{path.name}: {flag}" for flag in flags)

    metadata = {
        "timestamp": timestamp.isoformat(),
        "sr": sr,
        "input_device_name": options["devices"][input_id]["name"],
        "output_device_name": options["devices"][output_id]["name"],
        "parameters": body.model_dump() | {"input_device": input_id, "output_device": output_id},
        "recorded_input_channels": inputs,
        "has_loopback": loopback is not None,
    }
    return sweep, raw_paths, warnings, loopback_index, metadata


def finish_measurement(body: MeasureRequest, capture, heavy_compute):
    sweep, raw_paths, warnings, loopback_index, metadata = capture
    directory = raw_paths[0].parent
    metadata_path = directory / "rir.json"
    ir_path = lane = delay = None
    if warnings:
        reason = "; ".join(warnings) + ". Retake the RIR measurement."
    else:
        reason = None
        with heavy_compute:
            recorded, _ = read_audio(raw_paths[0])
            for path in raw_paths[1:]:
                take, _ = read_audio(path)
                recorded += take
            recorded /= body.repeats
            ir, delay = deconvolve(
                sweep,
                recorded,
                body.sr,
                body.f1_hz,
                body.f2_hz,
                round(body.ir_length_s * body.sr),
                loopback_index,
            )
        ir_path = directory / "rir.wav"
        write_audio(ir_path, ir, body.sr, "WAV", "FLOAT")
        lane = Lane("RIR", str(ir_path), ir, body.sr, rir_time_zero_calibrated=delay is not None)
    result = {
        "valid": not warnings,
        "reason": reason,
        "raw_paths": [str(path) for path in raw_paths],
        "ir_path": None if ir_path is None else str(ir_path),
        "metadata_path": str(metadata_path),
        "time_zero_calibrated": delay is not None,
        "loopback_delay_samples": delay,
    }
    metadata_path.write_text(json.dumps(metadata | result, indent=2) + "\n", encoding="utf-8")
    return result, lane


def register_rir(app, session, find_audio, publish_lanes, recording, heavy_compute) -> None:
    @app.post("/api/rir/analyze")
    def analyze(body: AnalyzeRequest):
        from vsr.dsp.rir import analyze_rir, octave_bands

        with session.lock:
            lane = find_audio(body.lane)
            if body.channel >= lane.data.shape[0]:
                raise HTTPException(422, "Invalid channel")
            sr = lane.sr
            if (
                body.truncation_s is not None
                and not 1 <= round(body.truncation_s * sr) <= lane.data.shape[-1]
            ):
                raise HTTPException(
                    422, "Truncation must end within the lane after at least one sample"
                )
            if body.bands is not None and not set(body.bands).issubset(octave_bands(sr)):
                raise HTTPException(422, "An octave band is unsupported at the lane's sample rate")
            data = lane.data[body.channel].clone()
        with heavy_compute:
            return analyze_rir(data, sr, body.bands, body.use_lundeby, body.truncation_s)

    @app.post("/api/rir/sweep_preview")
    async def sweep_preview(body: PreviewRequest):
        async with recording.rir_devices():
            await run_in_threadpool(play_preview, body)
        return {"ok": True}

    @app.post("/api/rir/measure")
    async def measure(body: MeasureRequest):
        async with recording.rir_devices():
            capture = await run_in_threadpool(capture_measurement, body, recording.directory)
        result, lane = await run_in_threadpool(finish_measurement, body, capture, heavy_compute)
        return result | ({"lanes": []} if lane is None else await publish_lanes([lane]))
