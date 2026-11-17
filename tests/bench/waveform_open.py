"""Measure the first waveform draw for a generated ten-minute stereo WAV."""

import json
import os
import platform
import subprocess
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf

from vsr.device import available_devices

with tempfile.TemporaryDirectory(prefix="vsr-bench-") as directory:
    root = Path(directory)
    audio = root / "ten-minutes.wav"
    t = np.arange(48000, dtype=np.float32) / 48000
    block = np.column_stack(
        (0.25 * np.sin(2 * np.pi * 440 * t), 0.25 * np.sin(2 * np.pi * 660 * t))
    )
    with sf.SoundFile(audio, mode="w", samplerate=48000, channels=2, subtype="PCM_16") as output:
        for _ in range(600):
            output.write(block)
    for device in available_devices():
        for iteration in range(3):
            home = root / f"{device.replace(':', '-')}-{iteration}"
            home.mkdir()
            result = subprocess.check_output(
                ["node", "tests/bench/waveform_open.ts", str(audio), str(home), device],
                env={**os.environ, "VSR_HOME": str(home)},
                text=True,
            )
            print(
                json.dumps(
                    {
                        "platform": platform.platform(),
                        "device": device,
                        "run": iteration + 1,
                        "seconds": float(result.strip()),
                    }
                ),
                flush=True,
            )
