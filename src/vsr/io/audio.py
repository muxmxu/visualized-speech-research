"""Read audio, and write files atomically: explicitly saved audio and the `vsr scan` outputs."""

import os
import secrets
import stat
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

import soundfile as sf
import torch

AUDIO_EXTENSIONS = {".wav", ".flac", ".ogg", ".mp3"}
SAVE_FORMATS = {".wav": "WAV", ".flac": "FLAC"}


def read_audio(path: Path) -> tuple[torch.Tensor, int]:
    data, sr = sf.read(path, dtype="float32", always_2d=True)
    return torch.from_numpy(data.T.copy()), sr


@contextmanager
def atomic_path(path: Path) -> Iterator[Path]:
    """Yield a sibling temporary file that replaces `path` when the block succeeds."""
    temporary = path.with_name(f".{path.name}.{secrets.token_hex(8)}.tmp")
    # Owner-only while replacing a file, as its mode may be stricter than the default. A new file
    # gets 0o666 under the umask, the default mode (unlike mkstemp's 0o600).
    mode = 0o600 if path.exists() else 0o666
    os.close(os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode))
    try:
        yield temporary
        # Applied after writing so that a read-only original can still be replaced.
        if path.exists():
            os.chmod(temporary, stat.S_IMODE(path.stat().st_mode))
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_audio(path: Path, data: torch.Tensor, sr: int, format: str, subtype: str) -> None:
    with atomic_path(path) as temporary:
        sf.write(temporary, data.T.numpy(), sr, format=format, subtype=subtype)
