import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf
import torch
from fastapi.testclient import TestClient
from scipy.signal import butter, fftconvolve, sosfiltfilt

from vsr.dsp.sweep import deconvolve
from vsr.server import routes_record
from vsr.server.app import create_app

SR = 48_000
LOOPBACK_DELAY = 240
IR_LENGTH = SR


class SimulatedDuplex:
    default = SimpleNamespace(device=(0, 1))
    PortAudioError = RuntimeError

    def __init__(self):
        self.acoustic = np.zeros(IR_LENGTH, dtype=np.float32)
        self.acoustic[[384, 911, 2036]] = [0.7, -0.2, 0.07]
        self.loopback = np.zeros(LOOPBACK_DELAY + 1, dtype=np.float32)
        self.loopback[LOOPBACK_DELAY] = 0.85
        self.rng = np.random.default_rng(714)
        self.overflow_take = None
        self.takes = []
        self.status_reads = 0

    def query_devices(self):
        return [
            {
                "name": "Simulated microphone and loopback",
                "max_input_channels": 2,
                "max_output_channels": 0,
                "default_samplerate": SR,
            },
            {
                "name": "Simulated output",
                "max_input_channels": 0,
                "max_output_channels": 2,
                "default_samplerate": SR,
            },
        ]

    def check_input_settings(self, *, device, channels, samplerate, dtype):
        assert (device, channels, samplerate, dtype) == (0, 2, SR, "float32")

    def check_output_settings(self, *, device, channels, samplerate, dtype):
        assert (device, channels, samplerate, dtype) == (1, 2, SR, "float32")

    def playrec(self, playback, *, samplerate, out, input_mapping, device, blocking):
        assert blocking and samplerate == SR and device == (0, 1)
        assert self.status_reads == len(self.takes)
        assert not playback[:, 0].any()
        sweep = playback[:, 1]
        mic = np.pad(self.acoustic, (LOOPBACK_DELAY, 0))
        data = np.stack(
            [fftconvolve(sweep, response)[: len(sweep)] for response in (mic, self.loopback)],
            axis=1,
        )
        sweep_rms = np.sqrt(np.mean(sweep**2))
        data += self.rng.standard_normal(data.shape, dtype=np.float32) * sweep_rms * 10**-4
        self.takes.append(data[:, np.asarray(input_mapping) - 1])
        for first in range(0, len(sweep), 547):
            last = min(first + 547, len(sweep))
            for column, source in enumerate(input_mapping):
                out[first:last, column] = data[first:last, source - 1]
        return out

    def get_status(self):
        self.status_reads += 1
        return SimpleNamespace(
            input_underflow=False,
            input_overflow=self.status_reads == self.overflow_take,
            output_underflow=False,
            output_overflow=False,
        )


@pytest.fixture
def rir_measurement(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "vsr"))
    devices = SimulatedDuplex()
    monkeypatch.setattr(routes_record, "load_sounddevice", lambda: (devices, None))
    with TestClient(
        create_app("secret", "cpu"), headers={"Authorization": "Bearer secret"}
    ) as client:
        yield client, devices


def request_measurement(client, **overrides):
    response = client.post(
        "/api/rir/measure",
        json={
            "sr": SR,
            "input_device": None,
            "output_device": None,
            "input_channels": [0, 1],
            "output_channel": 1,
            "loopback_channel": 1,
            **overrides,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_ess_reconstructs_acoustic_response_and_calibrates_loopback(rir_measurement):
    client, devices = rir_measurement
    result = request_measurement(client)
    assert result["valid"] and result["time_zero_calibrated"]
    delay_error = abs(result["loopback_delay_samples"] - LOOPBACK_DELAY)
    assert delay_error <= 1
    recovered, sr = sf.read(result["ir_path"], dtype="float32", always_2d=True)
    assert sr == SR
    assert recovered.shape == (IR_LENGTH, 1)
    assert sf.info(result["ir_path"]).subtype == "FLOAT"
    sos = butter(8, [100, 10_000], "bandpass", fs=sr, output="sos")
    expected = sosfiltfilt(sos, devices.acoustic)
    error = sosfiltfilt(sos, recovered[:, 0]) - expected
    error_db = 20 * np.log10(np.linalg.norm(error) / np.linalg.norm(expected))
    print(f"ESS bandpassed relative IR error {error_db:.2f} dB, loopback delay error {delay_error}")
    assert error_db < -40
    (lane,) = result["lanes"]
    assert lane["channels"] == 1 and lane["rir_time_zero_calibrated"] is True


def test_overflow_in_one_repetition_invalidates_the_entire_measurement(rir_measurement):
    client, devices = rir_measurement
    devices.overflow_take = 1
    result = request_measurement(
        client, duration_s=0.2, pre_silence_s=0, tail_silence_s=0.1, repeats=2, ir_length_s=0.1
    )
    assert devices.status_reads == 2
    assert not result["valid"]
    assert "overflow" in result["reason"] and "Retake" in result["reason"]
    assert result["lanes"] == [] and result["ir_path"] is None
    assert client.get("/api/session").json()["lanes"] == []
    assert len(result["raw_paths"]) == 2
    for path, expected in zip(result["raw_paths"], devices.takes, strict=True):
        recorded, sr = sf.read(path, dtype="float32", always_2d=True)
        assert sr == SR
        np.testing.assert_array_equal(recorded, expected)
    metadata = json.loads(Path(result["metadata_path"]).read_text())
    assert not metadata["valid"] and metadata["reason"] == result["reason"]


def test_deconvolution_discards_wrapped_negative_lags():
    frames = 257
    last_nonnegative_lag = 128
    loopback_delay = 7
    excitation = np.zeros(frames, dtype=np.float32)
    excitation[0] = 1
    captured = torch.zeros((2, frames), dtype=torch.float32)
    captured[0, 12] = 0.75
    captured[0, last_nonnegative_lag] = 0.125
    captured[0, -9] = 1
    captured[1, loopback_delay] = 0.75
    captured[1, -9] = 2

    response, delay = deconvolve(excitation, captured, SR, 1, SR / 2 - 1, frames, 1)

    assert delay == loopback_delay
    assert response.shape == (1, frames)
    assert response[0].argmax().item() == 12 - loopback_delay
    assert response[0, last_nonnegative_lag - loopback_delay] > 0.1
    assert torch.count_nonzero(response[0, last_nonnegative_lag - loopback_delay + 1 :]) == 0
