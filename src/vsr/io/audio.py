"""Read audio and write explicitly saved audio atomically."""

import os
from pathlib import Path
from tempfile import mkstemp

import soundfile as sf
import torch

AUDIO_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3"}
SAVE_FORMATS = {".wav": "WAV", ".flac": "FLAC"}


def read_audio(path: Path) -> tuple[torch.Tensor, int]:
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T.copy()), sr


def write_audio(path: Path, data: torch.Tensor, sr: int, format: str, subtype: str) -> None:
    descriptor, name = mkstemp(dir=path.parent, prefix=f".{path.name}.", suffix=".tmp")
    temporary = Path(name)
    try:
        os.close(descriptor)
        sf.write(temporary, data.T.numpy(), sr, format=format, subtype=subtype)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)
