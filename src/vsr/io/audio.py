"""Load audio without modifying its source."""

from pathlib import Path

import soundfile as sf
import torch

AUDIO_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3"}


def read_audio(path: Path) -> tuple[torch.Tensor, int]:
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T.copy()), sr
