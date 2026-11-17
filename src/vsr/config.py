"""Local configuration."""

import os
import tomllib
from pathlib import Path


def home() -> Path:
    return Path(os.environ.get("VSR_HOME", Path.home() / ".vsr"))


def load_config() -> dict:
    root = home()
    config = {
        "recordings_dir": str(root / "recordings"),
        "plugin_dirs": [str(root / "plugins")],
        "compute_device": "auto",
        "cache_bytes": 2 * 1024**3,
        "port": 8765,
    }
    path = root / "config.toml"
    if path.exists():
        with path.open("rb") as file:
            config.update(tomllib.load(file))
    return config
