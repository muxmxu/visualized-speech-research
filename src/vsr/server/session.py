"""In-memory audio and feature lanes."""

from collections import OrderedDict
from dataclasses import dataclass, field
from threading import RLock
from uuid import uuid4

import torch


@dataclass
class Lane:
    name: str
    source: str
    data: torch.Tensor
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

    frame_rate: float | None = None
    frame_t0: float = 0.0
    freq_axis: dict | None = None
    value_scale: str | None = None

    def metadata(self) -> dict:
        fields = {"data", "frame_rate", "frame_t0", "freq_axis", "value_scale"}
        meta = {key: value for key, value in vars(self).items() if key not in fields}
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
class Session:
    lanes: list[Lane] = field(default_factory=list)
    lock: RLock = field(default_factory=RLock)
    cache_lock: RLock = field(default_factory=RLock)
    cache: OrderedDict = field(default_factory=OrderedDict)
    cache_size: int = 0
    cache_generation: int = 0
    inflight: dict = field(default_factory=dict)

    def lane(self, lane_id: str) -> Lane:
        return next(lane for lane in self.lanes if lane.id == lane_id)
