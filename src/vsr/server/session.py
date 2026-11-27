"""In-memory lanes and grouped session history."""

from collections import OrderedDict, deque
from dataclasses import dataclass, field
from threading import RLock
from uuid import uuid4

import torch


@dataclass
class Lane:
    name: str
    source: str
    data: torch.Tensor | None
    sr: int
    id: str = field(default_factory=lambda: uuid4().hex[:8])
    kind: str = "audio"
    version: int = 0
    offset: float = 0.0
    parent: str | None = None
    dirty: bool = False
    stale: bool = False
    gain_db: float = 0.0
    mute: bool = False
    solo: bool = False
    record_warnings: list[dict] = field(default_factory=list)
    rir_time_zero_calibrated: bool | None = None

    frame_rate: float | None = None
    frame_t0: float = 0.0
    freq_axis: dict | None = None
    value_scale: str | None = None

    times: torch.Tensor | None = None
    values: torch.Tensor | None = None
    unit: str | None = None
    y_scale: str = "linear"
    overlay: bool = False
    labels: list[str] = field(default_factory=list)
    items: list[tuple[float, float, str]] = field(default_factory=list)
    _content_version: int = 0
    _saved_content_version: int = 0

    def mark_saved(self) -> None:
        self._saved_content_version = self._content_version
        self.dirty = False

    def metadata(self) -> dict:
        fields = {
            "data",
            "frame_rate",
            "frame_t0",
            "freq_axis",
            "value_scale",
            "times",
            "values",
            "unit",
            "y_scale",
            "overlay",
            "labels",
            "items",
        }
        meta = {
            key: value
            for key, value in vars(self).items()
            if key not in fields and not key.startswith("_")
        }
        if self.rir_time_zero_calibrated is None:
            del meta["rir_time_zero_calibrated"]
        if self.kind != "audio":
            del meta["record_warnings"]
        if self.kind == "curve":
            curves, points = self.values.shape
            return meta | {
                "unit": self.unit,
                "y_scale": self.y_scale,
                "overlay": self.overlay,
                "labels": self.labels,
                "curves": curves,
                "points": points,
                "duration": float(self.times.numpy().max()) if points else 0.0,
            }
        if self.kind == "events":
            return meta | {"duration": max((end for _, end, _ in self.items), default=0.0)}
        rows, frames = self.data.shape
        if self.kind == "feature":
            return meta | {
                "rows": rows,
                "frames": frames,
                "frame_rate": self.frame_rate,
                "frame_t0": self.frame_t0,
                "freq_axis": self.freq_axis,
                "value_scale": self.value_scale,
            }
        return meta | {"channels": rows, "samples": frames}


@dataclass
class RecordingMetadata:
    source: str
    sr: int
    offset: float
    record_warnings: list[dict]
    rir_time_zero_calibrated: bool | None
    saved_content_version: int

    @classmethod
    def from_lane(cls, lane: Lane):
        return cls(
            lane.source,
            lane.sr,
            lane.offset,
            lane.record_warnings,
            lane.rir_time_zero_calibrated,
            lane._saved_content_version,
        )

    def apply(self, lane: Lane) -> None:
        lane.source = self.source
        lane.sr = self.sr
        lane.record_warnings = self.record_warnings
        lane.rir_time_zero_calibrated = self.rir_time_zero_calibrated
        lane._saved_content_version = self.saved_content_version


@dataclass
class EditGroup:
    snapshots: dict[str, tuple[torch.Tensor, int]]
    created: list[Lane]
    recordings: dict[str, RecordingMetadata] = field(default_factory=dict)

    @property
    def nbytes(self) -> int:
        return sum(data.nbytes for data, _ in self.snapshots.values()) + sum(
            lane.data.nbytes for lane in self.created
        )


@dataclass
class Session:
    lanes: list[Lane] = field(default_factory=list)
    lock: RLock = field(default_factory=RLock)
    cache_lock: RLock = field(default_factory=RLock)
    cache: OrderedDict = field(default_factory=OrderedDict)
    cache_size: int = 0
    cache_generation: int = 0
    inflight: dict = field(default_factory=dict)
    history_budget: int = 2**31
    undo_history: deque[EditGroup] = field(default_factory=deque)
    redo_history: deque[EditGroup] = field(default_factory=deque)
    clipboard: list[tuple[torch.Tensor, int]] = field(default_factory=list)

    def lane(self, lane_id: str) -> Lane:
        return next(lane for lane in self.lanes if lane.id == lane_id)

    def descendants(self, lane_id: str):
        pending = [lane_id]
        while pending:
            parent = pending.pop()
            for lane in self.lanes:
                if lane.parent == parent:
                    pending.append(lane.id)
                    yield lane

    def set_offset(self, lane: Lane, offset: float) -> None:
        delta = offset - lane.offset
        lane.offset = offset
        for child in self.descendants(lane.id):
            child.offset += delta

    def mark_derived_stale(self, lane_id: str) -> None:
        for child in self.descendants(lane_id):
            child.stale = True

    def remove_lanes(self, lane_ids: set[str]) -> set[str]:
        removed = lane_ids | {
            child.id for lane_id in lane_ids for child in self.descendants(lane_id)
        }
        self.lanes[:] = [lane for lane in self.lanes if lane.id not in removed]
        return removed

    def publish_derived(self, lane: Lane) -> None:
        for index, previous in enumerate(self.lanes):
            if previous.parent == lane.parent and previous.source == lane.source:
                lane.id = previous.id
                lane.name = previous.name
                lane.version = previous.version + 1
                lane.gain_db, lane.mute, lane.solo = previous.gain_db, previous.mute, previous.solo
                self.set_offset(previous, lane.offset)
                self.mark_derived_stale(previous.id)
                self.forget_closed_lane(previous.id)
                self.lanes[index] = lane
                return
        self.lanes.append(lane)

    def _set_content(self, lane: Lane, data: torch.Tensor, content_version: int) -> None:
        lane.data = data
        lane.version += 1
        lane._content_version = content_version
        lane.dirty = content_version != lane._saved_content_version
        self.mark_derived_stale(lane.id)

    def _limit_history(self) -> None:
        used = sum(group.nbytes for group in self.undo_history) + sum(
            group.nbytes for group in self.redo_history
        )
        while used > self.history_budget and self.undo_history:
            used -= self.undo_history.popleft().nbytes
        # Redo steps depend on the earlier groups that lead to them.
        if used > self.history_budget:
            self.redo_history.clear()

    def record_edit(self, updates: list[tuple[Lane, torch.Tensor]], created: list[Lane]) -> None:
        self._record_group(updates, created, {})

    def record_take(self, replacements: list[tuple[Lane, Lane]], created: list[Lane]) -> None:
        self._record_group(
            [(lane, take.data) for lane, take in replacements],
            created,
            {
                lane.id: RecordingMetadata(
                    take.source,
                    take.sr,
                    take.offset,
                    take.record_warnings,
                    take.rir_time_zero_calibrated,
                    lane.version + 1,
                )
                for lane, take in replacements
            },
        )

    def _record_group(
        self,
        updates: list[tuple[Lane, torch.Tensor]],
        created: list[Lane],
        recordings: dict[str, RecordingMetadata],
    ) -> None:
        # shortcut: whole-lane copies use more memory; use deltas when long files require it.
        snapshots = {lane.id: (lane.data.clone(), lane._content_version) for lane, _ in updates}
        old_recordings = {
            lane.id: RecordingMetadata.from_lane(lane)
            for lane, _ in updates
            if lane.id in recordings
        }
        self.undo_history.append(EditGroup(snapshots, created, old_recordings))
        self.redo_history.clear()
        for lane, data in updates:
            if lane.id in recordings:
                recording = recordings[lane.id]
                self.set_offset(lane, recording.offset)
                recording.apply(lane)
            self._set_content(lane, data, lane.version + 1)
        self.lanes.extend(created)
        self._limit_history()

    def move_history(self, redo: bool) -> list[Lane] | None:
        source, target = (
            (self.redo_history, self.undo_history)
            if redo
            else (self.undo_history, self.redo_history)
        )
        if not source:
            return None
        group = source.pop()
        changed = []
        for lane_id, (data, content_version) in group.snapshots.items():
            lane = self.lane(lane_id)
            group.snapshots[lane_id] = (lane.data, lane._content_version)
            if lane_id in group.recordings:
                previous = group.recordings[lane_id]
                group.recordings[lane_id] = RecordingMetadata.from_lane(lane)
                self.set_offset(lane, previous.offset)
                previous.apply(lane)
            self._set_content(lane, data, content_version)
            changed.append(lane)
        if redo:
            for lane in group.created:
                lane.version += 1
            self.lanes.extend(group.created)
            changed.extend(group.created)
        else:
            created_ids = {lane.id for lane in group.created}
            removed = self.remove_lanes(created_ids)
            for lane_id in removed - created_ids:
                self.forget_closed_lane(lane_id)
        target.append(group)
        self._limit_history()
        return changed

    def forget_closed_lane(self, lane_id: str) -> None:
        for history in (self.undo_history, self.redo_history):
            retained = []
            for group in history:
                group.snapshots.pop(lane_id, None)
                group.recordings.pop(lane_id, None)
                group.created[:] = [lane for lane in group.created if lane.id != lane_id]
                if group.snapshots or group.created:
                    retained.append(group)
            history.clear()
            history.extend(retained)
