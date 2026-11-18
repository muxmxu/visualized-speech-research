"""Measure DESIGN §17 row 7 against a running Chromium workspace."""

import importlib
import json
import platform
import statistics
import subprocess
import sys
import tempfile

import numpy as np

from vsr import show
from vsr.device import available_devices

SAMPLE_RATE = 24_000
FREQUENCY = 440
AMPLITUDE = 0.5


def send() -> None:
    importlib.import_module("vsr.frame")
    time = np.arange(SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    signal = (AMPLITUDE * np.sin(2 * np.pi * FREQUENCY * time)).astype(np.float32)
    print("ready", flush=True)
    for line in sys.stdin:
        show(signal, sr=SAMPLE_RATE, name=line.strip())
        print("sent", flush=True)


def main() -> None:
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    print(
        json.dumps(
            {
                "platform": platform.platform(),
                "head": revision,
                "fixture": {
                    "samples": SAMPLE_RATE,
                    "sr": SAMPLE_RATE,
                    "channels": 1,
                    "dtype": "float32",
                    "frequency_hz": FREQUENCY,
                    "amplitude": AMPLITUDE,
                },
            }
        ),
        flush=True,
    )
    for device in available_devices():
        with tempfile.TemporaryDirectory(prefix="vsr-m2-bench-") as home:
            result = subprocess.check_output(
                ["node", "tests/bench/m2_show.ts", home, device, sys.executable],
                text=True,
            )
        rows = [json.loads(line) for line in result.splitlines()]
        assert len(rows) == 3
        for row in rows:
            print(json.dumps(row), flush=True)
        print(
            json.dumps(
                {"device": device, "median_ms": statistics.median(row["ms"] for row in rows)}
            ),
            flush=True,
        )


if __name__ == "__main__":
    main()
