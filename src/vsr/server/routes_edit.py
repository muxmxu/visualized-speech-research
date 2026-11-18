"""Session audio edits, grouped history, and explicit saves."""

from pathlib import Path
from typing import Literal

import soundfile as sf
import torch
from fastapi import HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, model_validator

from vsr.api import compute_device
from vsr.dsp.edit import attenuate_interval, edit_samples, insert_samples, masked_interval
from vsr.io.audio import SAVE_FORMATS, write_audio
from vsr.server.session import Lane

_SPECTRAL_FIELDS = ("f_lo", "f_hi", "n_fft", "win_length", "window", "window_param")


class EditParameters(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lane_ids: list[str] = Field(default_factory=list)
    duration_s: FiniteFloat | None = Field(None, gt=0)
    gain_db: FiniteFloat | Literal["-inf"] | None = None
    target_dbfs: FiniteFloat | None = None
    curve: Literal["linear", "equal-power"] = "linear"
    f_lo: FiniteFloat | None = Field(None, ge=0)
    f_hi: FiniteFloat | None = None
    n_fft: int | None = Field(None, gt=0)
    win_length: int | None = Field(None, ge=4)
    window: (
        Literal["hann", "hamming", "blackman", "blackmanharris", "kaiser", "gaussian"] | None
    ) = None
    window_param: FiniteFloat | None = None


class EditRequest(BaseModel):
    op: Literal[
        "delete",
        "cut",
        "copy",
        "paste",
        "silence",
        "insert_silence",
        "trim",
        "gain",
        "normalize",
        "fade_in",
        "fade_out",
        "invert",
        "mixdown_channels",
        "spectral_attenuate",
        "spectral_extract",
    ]
    t0: FiniteFloat | None = None
    t1: FiniteFloat | None = None
    channel: int | None = Field(None, ge=0)
    params: EditParameters = Field(default_factory=EditParameters)

    @model_validator(mode="after")
    def validate_edit(self):
        op, p = self.op, self.params
        if op in {"paste", "insert_silence"}:
            if self.t0 is None:
                raise ValueError("A playhead is required")
        elif self.t0 is not None or self.t1 is not None:
            if self.t0 is None or self.t1 is None or self.t1 <= self.t0:
                raise ValueError("Selection must have increasing time bounds")
        elif op in {"delete", "cut", "trim", "spectral_attenuate", "spectral_extract"}:
            raise ValueError("This edit requires a selection")

        if op == "insert_silence" and p.duration_s is None:
            raise ValueError("Insert Silence requires duration_s")
        if op in {"gain", "spectral_attenuate"} and p.gain_db is None:
            raise ValueError("This edit requires gain_db")
        if op == "gain" and p.gain_db == "-inf":
            raise ValueError("Time-domain gain must be finite")
        if op == "normalize" and p.target_dbfs is None:
            raise ValueError("Normalize requires target_dbfs")

        fields = [getattr(p, name) for name in _SPECTRAL_FIELDS]
        if op == "spectral_attenuate" or any(value is not None for value in fields):
            if op not in {"spectral_attenuate", "spectral_extract"}:
                raise ValueError("T-F parameters require a spectral operation")
            if any(value is None for value in fields):
                raise ValueError("Incomplete T-F parameters")
            if p.f_hi <= p.f_lo or p.win_length > p.n_fft or p.lane_ids:
                raise ValueError("Invalid T-F bounds, transform parameters, or lane selection")
            if (p.window == "gaussian" and p.window_param <= 0) or (
                p.window not in {"gaussian", "kaiser"} and p.window_param != 0
            ):
                raise ValueError("Invalid window parameter")
        return self


class SaveRequest(BaseModel):
    path: str | None = None
    subtype: str = Field(min_length=1)


def sample_bound(lane: Lane, position: float) -> int:
    return round(max(0, min(lane.data.shape[1], (position - lane.offset) * lane.sr)))


def source_path(lane: Lane) -> Path | None:
    path = Path(lane.source)
    return path.resolve() if path.is_absolute() else None


def save_target(lane: Lane, lanes: list[Lane], path: str | None) -> Path:
    source = source_path(lane)
    if path:
        target = Path(path).expanduser().resolve()
        if any(source_path(other) == target for other in lanes):
            raise HTTPException(
                400, "Save As requires a different path. Use Save for the original file."
            )
        return target
    if (
        source is None
        or source.suffix.lower() not in SAVE_FORMATS
        or any(other.id != lane.id and source_path(other) == source for other in lanes)
    ):
        raise HTTPException(400, "This source cannot be overwritten. Use Save As.")
    return source


def register_edit(app, session, find_audio, heavy_compute, connections):
    def apply_edit(lane_id, body):
        op, p = body.op, body.params
        with heavy_compute, session.lock:
            lanes = [find_audio(key) for key in dict.fromkeys((lane_id, *p.lane_ids))]
            spans = []
            for lane in lanes:
                if body.channel is not None and body.channel >= lane.data.shape[0]:
                    raise HTTPException(422, "Invalid channel")
                if op in {"insert_silence", "paste"}:
                    start = end = sample_bound(lane, body.t0)
                elif body.t0 is None or op == "mixdown_channels":
                    start, end = 0, lane.data.shape[1]
                else:
                    start, end = sample_bound(lane, body.t0), sample_bound(lane, body.t1)
                if start == end and op not in {"insert_silence", "paste"}:
                    continue
                spans.append((lane, start, end))
            if not spans:
                raise HTTPException(422, "Selection does not contain audio samples")

            device = compute_device()
            channels = (
                slice(None) if body.channel is None else slice(body.channel, body.channel + 1)
            )
            if op in {"copy", "cut"}:
                clipboard = [(lane.data[channels, a:b].clone(), lane.sr) for lane, a, b in spans]
                if op == "copy":
                    session.clipboard = clipboard
                    return None

            if op == "paste":
                if not session.clipboard:
                    raise HTTPException(422, "The audio clipboard is empty")
                if len(spans) != 1 and len(session.clipboard) not in {1, len(spans)}:
                    raise HTTPException(422, "The clipboard and selected lane counts must match")

            updates, created = [], []
            for index, (lane, start, end) in enumerate(spans):
                if op == "paste":
                    clip, sr = session.clipboard[0 if len(session.clipboard) == 1 else index]
                    if sr != lane.sr:
                        raise HTTPException(422, "The clipboard and lane sample rates must match")
                    channel_count = lane.data.shape[0] if body.channel is None else 1
                    if clip.shape[0] != channel_count and 1 not in (clip.shape[0], channel_count):
                        raise HTTPException(422, "The clipboard and lane channel counts must match")
                    result = insert_samples(lane.data, start, body.channel, device, clip=clip)
                elif op == "insert_silence":
                    frames = round(p.duration_s * lane.sr)
                    if frames == 0:
                        raise HTTPException(422, "Insert Silence duration is shorter than a sample")
                    result = insert_samples(lane.data, start, body.channel, device, frames=frames)
                elif op in {"spectral_attenuate", "spectral_extract"}:
                    selected = lane.data[channels]
                    if p.n_fft is not None:
                        mask = {name: getattr(p, name) for name in _SPECTRAL_FIELDS}
                        mask |= {"t0": body.t0 - lane.offset, "t1": body.t1 - lane.offset}
                    if op == "spectral_attenuate":
                        gain = 0 if p.gain_db == "-inf" else 10 ** (p.gain_db / 20)
                        first, last, modified = attenuate_interval(
                            selected, start, end, lane.sr, device, gain, **mask
                        )
                        result = lane.data.clone()
                        result[channels, first:last] = modified
                    else:
                        data = (
                            selected[:, start:end].clone()
                            if p.n_fft is None
                            else torch.from_numpy(
                                masked_interval(
                                    selected,
                                    selected.shape[1],
                                    0,
                                    start,
                                    end,
                                    lane.sr,
                                    device=device,
                                    **mask,
                                )
                            )
                        )
                        name = f"{lane.name} extract"
                        created.append(
                            Lane(
                                name,
                                f"push:{name}",
                                data,
                                lane.sr,
                                version=1,
                                dirty=True,
                                offset=lane.offset + start / lane.sr,
                                _content_version=1,
                            )
                        )
                        continue
                else:
                    result = edit_samples(
                        lane.data,
                        start,
                        end,
                        body.channel,
                        op,
                        device,
                        gain_db=p.gain_db,
                        target_dbfs=p.target_dbfs,
                        curve=p.curve,
                    )
                updates.append((lane, result))
            session.record_edit(updates, created)
            if op == "cut":
                session.clipboard = clipboard
            return [lane.metadata() for lane, _ in updates] + [lane.metadata() for lane in created]

    async def publish(changed):
        if changed is not None:
            await connections.broadcast()
        return {"lanes": [] if changed is None else changed}

    @app.post("/api/lanes/{lane_id}/edit")
    async def edit(lane_id: str, body: EditRequest):
        return await publish(await run_in_threadpool(apply_edit, lane_id, body))

    async def move_history(lane_id: str, redo: bool):
        with session.lock:
            find_audio(lane_id)
            changed = session.move_history(redo)
            metadata = None if changed is None else [lane.metadata() for lane in changed]
        return await publish(metadata)

    @app.post("/api/lanes/{lane_id}/undo")
    async def undo(lane_id: str):
        return await move_history(lane_id, False)

    @app.post("/api/lanes/{lane_id}/redo")
    async def redo(lane_id: str):
        return await move_history(lane_id, True)

    def save_file(lane_id, body):
        with session.lock:
            lane = find_audio(lane_id)
            target = save_target(lane, session.lanes, body.path)
            format = SAVE_FORMATS.get(target.suffix.lower())
            if format is None or not sf.check_format(format, body.subtype):
                raise HTTPException(400, "Choose a WAV or FLAC path and a supported subtype.")
            write_audio(target, lane.data, lane.sr, format, body.subtype)
            lane.mark_saved()
            return [lane.metadata()]

    @app.post("/api/lanes/{lane_id}/save")
    async def save(lane_id: str, body: SaveRequest):
        return await publish(await run_in_threadpool(save_file, lane_id, body))
