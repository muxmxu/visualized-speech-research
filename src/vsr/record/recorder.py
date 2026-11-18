"""PortAudio capture, streaming WAV output and recording feedback."""

import re
from collections.abc import Callable, Iterator
from concurrent.futures import Future, ThreadPoolExecutor
from contextlib import ExitStack
from dataclasses import dataclass
from datetime import datetime
from math import log10
from pathlib import Path
from queue import SimpleQueue
from threading import Event

import numpy as np
import soundfile as sf
from scipy.signal import correlate

from vsr.frame import encode_frame


@dataclass
class Block:
    samples: np.ndarray
    overflow: bool
    underflow: bool


class Capture:
    def __init__(
        self,
        sd,
        input_id: int,
        channels: int,
        sr: int,
        blocksize: int,
        *,
        output: tuple[int, np.ndarray] | None = None,
    ) -> None:
        self.portaudio_error = sd.PortAudioError
        self.blocks: SimpleQueue[Block | RuntimeError | None] = SimpleQueue()
        self.closing = Event()
        options = {
            "samplerate": sr,
            "blocksize": blocksize,
            "dtype": "float32",
            "finished_callback": self._finished,
        }
        if output is None:
            self.stream = sd.InputStream(
                device=input_id, channels=channels, callback=self._input, **options
            )
        else:
            output_id, self.output = output
            self.output_position = 0
            self.stream = sd.Stream(
                device=(input_id, output_id),
                channels=(channels, self.output.shape[1]),
                callback=self._duplex,
                **options,
            )

    def _input(self, indata, frames, time, status) -> None:
        self.blocks.put(Block(indata.copy(), status.input_overflow, status.output_underflow))

    def _duplex(self, indata, outdata, frames, time, status) -> None:
        output = self.output[self.output_position : self.output_position + frames]
        outdata[: len(output)] = output
        outdata[len(output) :] = 0
        self.output_position += frames
        self._input(indata, frames, time, status)

    def _finished(self) -> None:
        if not self.closing.is_set():
            self.blocks.put(RuntimeError("Audio device stream stopped unexpectedly"))

    def __iter__(self) -> Iterator[Block]:
        while (item := self.blocks.get()) is not None:
            if isinstance(item, RuntimeError):
                raise item
            yield item

    def start(self, consume: Callable[[Future], object]) -> None:
        ready: Future = Future()
        self.worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="vsr-record")
        self.result = self.worker.submit(consume, ready)

        def check_ready(result):
            if not ready.done():
                ready.set_exception(result.exception())

        self.result.add_done_callback(check_ready)
        started = False
        try:
            ready.result()
            self.stream.start()
            started = True
        finally:
            if not started:
                self.finish()

    def close(self) -> None:
        self.closing.set()
        try:
            try:
                if self.stream.active:
                    self.stream.stop(ignore_errors=False)
            finally:
                self.stream.close(ignore_errors=False)
        finally:
            self.blocks.put(None)
            self.worker.shutdown()

    def finish(self):
        self.close()
        return self.result.result()

    def finish_after_result(self):
        try:
            return self.result.result()
        finally:
            self.close()


class Meter:
    def __init__(self, sr: int, channels: int, send: Callable) -> None:
        self.interval = round(sr / 30)
        self.send = send
        self.peak = np.zeros(channels, dtype=np.float32)
        self.energy = np.zeros(channels, dtype=np.float64)
        self.samples = 0

    def add(self, samples: np.ndarray) -> None:
        np.maximum(self.peak, np.max(np.abs(samples), axis=0), out=self.peak)
        self.energy += np.sum(samples**2, axis=0, dtype=np.float64)
        self.samples += len(samples)
        if self.samples < self.interval:
            return
        self.send(
            {
                "type": "record_meter",
                "channels": [
                    {
                        "peak_dbfs": 20 * log10(peak) if peak else None,
                        "rms_dbfs": 10 * log10(energy / self.samples) if energy else None,
                        "clip": bool(peak >= 1),
                    }
                    for peak, energy in zip(self.peak, self.energy, strict=True)
                ],
            }
        )
        self.peak.fill(0)
        self.energy.fill(0)
        self.samples = 0


def monitor(capture: Capture, meter: Meter, ready: Future) -> None:
    ready.set_result(None)
    for block in capture:
        meter.add(block.samples)


def capture_click(capture: Capture, click: np.ndarray, sr: int, ready: Future) -> float:
    ready.set_result(None)
    samples = []
    remaining = sr
    for block in capture:
        if block.overflow or block.underflow:
            raise RuntimeError("Calibration had an audio overflow or underflow")
        samples.append(block.samples[:remaining, 0])
        remaining -= len(samples[-1])
        if remaining == 0:
            recorded = np.concatenate(samples)
            correlations = correlate(recorded, click, mode="full")[len(click) - 1 :]
            lag = int(np.argmax(np.abs(correlations)))
            if correlations[lag] == 0:
                raise ValueError("The calibration click was not heard on input 1")
            return 1000 * lag / sr
    raise RuntimeError("Calibration ended before the click could be measured")


@dataclass
class Track:
    lane_id: str | None
    name: str
    channels: list[int]


@dataclass
class Recorded:
    path: Path
    track: Track


class Take:
    def __init__(
        self,
        capture: Capture,
        meter: Meter,
        directory: Path,
        subtype: str,
        sr: int,
        blocksize: int,
        tracks: list[Track],
        send: Callable,
    ) -> None:
        self.capture = capture
        self.meter = meter
        self.directory = directory
        self.subtype = subtype
        self.sr = sr
        self.blocksize = blocksize
        self.tracks = tracks
        self.send = send
        self.warnings: list[dict] = []
        self.position = 0
        self.preview_start = 0
        self.preview: list[np.ndarray] = []
        self.silent = True

    def write(self, ready: Future) -> list[Recorded]:
        now = datetime.now()
        directory = self.directory / now.strftime("%Y-%m-%d")
        directory.mkdir(parents=True, exist_ok=True)
        recorded, files = [], []
        with ExitStack() as stack:
            for track in self.tracks:
                safe = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", track.name)
                stem = f"{now:%H%M%S}_{safe}"
                path = directory / f"{stem}.wav"
                sequence = 2
                while path.exists():
                    path = directory / f"{stem}_{sequence}.wav"
                    sequence += 1
                files.append(
                    stack.enter_context(
                        sf.SoundFile(
                            path,
                            mode="x",
                            samplerate=self.sr,
                            channels=len(track.channels),
                            subtype=self.subtype,
                            format="WAV",
                        )
                    )
                )
                recorded.append(Recorded(path, track))
            ready.set_result(None)
            for block in self.capture:
                for track, file in zip(self.tracks, files, strict=True):
                    file.write(block.samples[:, track.channels])
                self._update_feedback(block)
            self._send_preview()
        return recorded

    def _update_feedback(self, block: Block) -> None:
        samples = block.samples
        for happened, kind in (
            (block.overflow, "input_overflow"),
            (block.underflow, "output_underflow"),
        ):
            if happened:
                self.warnings.append({"time_s": self.position / self.sr, "type": kind})
        if self.position < self.sr:
            self.silent = self.silent and not np.any(samples[: self.sr - self.position])
            if self.position + len(samples) >= self.sr and self.silent:
                self.send("microphone_permission")
        self.position += len(samples)
        self.meter.add(samples)
        self.preview.append(np.stack([samples.min(axis=0), samples.max(axis=0)], axis=1))
        if self.position - self.preview_start >= self.sr / 10:
            self._send_preview()

    def _send_preview(self) -> None:
        if not self.preview:
            return
        data = np.stack(self.preview, axis=2)
        for index, track in enumerate(self.tracks):
            self.send(
                encode_frame(
                    data[track.channels],
                    {
                        "type": "record_preview",
                        "target": index,
                        "sr": self.sr,
                        "first_sample": self.preview_start,
                        "samples_per_column": self.blocksize,
                        "sample_count": self.position - self.preview_start,
                    },
                )
            )
        self.preview.clear()
        self.preview_start = self.position
