"""Measure DESIGN §17 rows 2–6 and the M1.10 cached full-lane response."""

import json
import platform
import statistics
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from vsr.device import available_devices

SAMPLE_RATE = 48000


def write_tone(path: Path, seconds: int, channels: int) -> None:
    with sf.SoundFile(
        path, "w", samplerate=SAMPLE_RATE, channels=channels, subtype="PCM_16"
    ) as output:
        for start in range(0, seconds * SAMPLE_RATE, SAMPLE_RATE):
            i = np.arange(start, start + SAMPLE_RATE, dtype=np.float64)
            signal = 0.4 * np.sin(2 * np.pi * 440 * i / SAMPLE_RATE) + 0.2 * np.sin(
                2 * np.pi * 3000 * i / SAMPLE_RATE
            )
            if channels == 2:
                right = 0.3 * np.sin(2 * np.pi * 660 * i / SAMPLE_RATE) + 0.15 * np.sin(
                    2 * np.pi * 2000 * i / SAMPLE_RATE
                )
                signal = np.column_stack((signal, right))
            output.write(signal)


def main() -> None:
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    with tempfile.TemporaryDirectory(prefix="vsr-m1-bench-") as directory:
        fixtures = Path(directory)
        write_tone(fixtures / "stereo.wav", 600, 2)
        write_tone(fixtures / "mono.wav", 60, 1)
        write_tone(fixtures / "wideband.wav", 600, 1)
        for device in available_devices():
            print(
                json.dumps({"platform": platform.platform(), "head": revision, "device": device}),
                flush=True,
            )
            process = subprocess.run(
                ["node", "tests/bench/m1_spectrogram.ts", directory, device],
                stdout=subprocess.PIPE,
                text=True,
                check=True,
            )
            rows = [json.loads(line) for line in process.stdout.splitlines()]
            for row in rows:
                print(json.dumps(row), flush=True)
            assert len(rows) == 3
            medians = {
                key: statistics.median(row["metrics"][key] for row in rows)
                for key in rows[0]["metrics"]
            }
            print(json.dumps({"device": device, "medians": medians}), flush=True)


if __name__ == "__main__":
    main()
