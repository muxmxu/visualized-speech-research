"""In-memory audio lanes."""

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

    def metadata(self) -> dict:
        return {key: value for key, value in vars(self).items() if key != "data"} | {
            "channels": self.data.shape[0],
            "samples": self.data.shape[1],
        }


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
