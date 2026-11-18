import builtins
from math import log10
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from vsr.frame import decode_frame
from vsr.server import routes_record
from vsr.server.app import create_app

SR = 8000


class SimulatedStream:
    def __init__(self, channels, callback, finished_callback, samplerate, blocksize, **options):
        self.callback = callback
        self.finished_callback = finished_callback
        self.channels = channels
        self.frames = blocksize
        self.sr = samplerate
        self.latency = (0.003, 0.007)
        self.active = False
        self.closed = False

    def start(self):
        self.active = True
        if self.channels == (1, 1):
            loopback = np.zeros((self.frames, 1), dtype=np.float32)
            for _ in range(self.sr // self.frames):
                loopback = self.feed(loopback)

    def stop(self, *, ignore_errors):
        self.active = False
        self.finished_callback()

    def close(self, *, ignore_errors):
        self.closed = True

    def feed(self, data, *, overflow=False, underflow=False):
        assert self.active
        status = SimpleNamespace(input_overflow=overflow, output_underflow=underflow)
        if isinstance(self.channels, tuple):
            output = np.empty((len(data), self.channels[1]), dtype=np.float32)
            self.callback(data, output, len(data), None, status)
            return output
        self.callback(data, len(data), None, status)

    def fail(self):
        self.active = False
        self.finished_callback()


class SimulatedDevices:
    class PortAudioError(RuntimeError):
        pass

    default = SimpleNamespace(device=(0, 1))

    def __init__(self):
        self.streams = []

    def query_devices(self):
        return [
            {
                "name": "Input",
                "max_input_channels": 2,
                "max_output_channels": 0,
                "default_samplerate": SR,
            },
            {
                "name": "Output",
                "max_input_channels": 0,
                "max_output_channels": 2,
                "default_samplerate": SR,
            },
        ]

    def check_input_settings(self, **params):
        assert params["device"] == 0

    def check_output_settings(self, **params):
        assert params["device"] == 1

    def InputStream(self, **params):
        assert isinstance(params["channels"], int)
        return self._new_stream(**params)

    def Stream(self, **params):
        assert isinstance(params["channels"], tuple)
        return self._new_stream(**params)

    def _new_stream(self, **params):
        assert all(stream.closed for stream in self.streams)
        stream = SimulatedStream(**params)
        self.streams.append(stream)
        return stream


@pytest.fixture
def audio(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "state"))
    devices = SimulatedDevices()
    monkeypatch.setattr(routes_record, "load_sounddevice", lambda: (devices, None))
    with TestClient(
        create_app("secret", "cpu"), headers={"Authorization": "Bearer secret"}
    ) as client:
        yield client, devices


def post(client, path, body=None):
    response = client.post(f"/api/{path}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def open_wav(client, path, data):
    sf.write(path, data, SR, subtype="FLOAT")
    return post(client, "open", {"paths": [str(path)]})["lanes"][0]


def start(client, *, mapping=(), blocksize=800, **settings):
    return post(
        client,
        "record/start",
        {
            "input_device": None,
            "sr": SR,
            "blocksize": blocksize,
            "subtype": "FLOAT",
            "mapping": list(mapping),
            "overdub": False,
            "latency_ms": None,
            "start_time": 0.0,
        }
        | settings,
    )


def event(socket, kind, notice=None):
    while True:
        message = socket.receive()
        assert message["type"] == "websocket.send"
        if "bytes" in message:
            samples, header = decode_frame(message["bytes"])
            if header["type"] == kind:
                return samples, header
        else:
            import json

            body = json.loads(message["text"])
            if body["type"] == kind and (notice is None or body["notice"] == notice):
                return body


def recorded_path(lane):
    return Path(lane["source"].removeprefix("record:"))


def lane_pcm(client, lane, *, start_time=0, samples):
    response = client.get(
        f"/api/lanes/{lane['id']}/pcm",
        params={"t0": start_time, "t1": start_time + samples / SR, "sr": SR},
    )
    assert response.status_code == 200, response.text
    return decode_frame(response.content)[0]


def test_arm_record_two_channels_and_undo(audio, tmp_path):
    client, devices = audio
    original = tmp_path / "original.wav"
    old_samples = np.array([0.125, -0.125], dtype=np.float32)
    lane = open_wav(client, original, old_samples)
    original_bytes = original.read_bytes()
    route = [{"lane": lane["id"], "channels": [0]}, {"lane": None, "channels": [1]}]
    body = {"input_device": None, "sr": SR, "blocksize": 400, "mapping": route}
    signal = np.random.default_rng(42).uniform(-0.75, 0.75, size=(1200, 2)).astype(np.float32)

    with client.websocket_connect("/ws?token=secret") as socket:
        armed = post(client, "record/arm", body)
        assert socket.receive_json() == armed
        assert armed["state"] == "armed"
        meter_stream = devices.streams[-1]
        meter_stream.feed(np.full((400, 2), 0.5, dtype=np.float32))
        for channel in socket.receive_json()["channels"]:
            assert channel["peak_dbfs"] == pytest.approx(-6.0206)
            assert channel["rms_dbfs"] == pytest.approx(-6.0206)
            assert not channel["clip"]

        state = start(client, mapping=route, blocksize=400, start_time=0.25, latency_ms=10)
        assert state["state"] == "recording"
        assert socket.receive_json() == state
        assert meter_stream.closed
        stream = devices.streams[-1]
        for index, block in enumerate(np.split(signal, 3)):
            stream.feed(block, overflow=index == 1)
        preview, header = event(socket, "record_preview")
        assert header["target"] == 0 and header["first_sample"] == 0
        assert header["sample_count"] == 800 and header["samples_per_column"] == 400
        blocks = signal[:800, 0].reshape(2, 400)
        np.testing.assert_array_equal(
            preview, np.array([[blocks.min(axis=1), blocks.max(axis=1)]], dtype=np.float32)
        )

        take, new = post(client, "record/stop")["lanes"]
        assert event(socket, "lanes_changed") == {"type": "lanes_changed"}
        assert event(socket, "record_state") == armed
        assert stream.closed and devices.streams[-1].active

    assert take["id"] == lane["id"] and new["id"] != lane["id"]
    for index, result in enumerate((take, new)):
        assert result["offset"] == 0.25
        assert result["samples"] == 1200
        assert result["record_warnings"] == [{"time_s": 0.05, "type": "input_overflow"}]
        data, sr = sf.read(recorded_path(result), dtype="float32")
        assert sr == SR
        np.testing.assert_array_equal(data, signal[:, index])
    assert original.read_bytes() == original_bytes

    undone = post(client, f"lanes/{lane['id']}/undo")["lanes"][0]
    assert undone | {"version": lane["version"]} == lane
    assert len(client.get("/api/session").json()["lanes"]) == 1
    np.testing.assert_array_equal(lane_pcm(client, undone, samples=2), old_samples[None])
    redone, redone_new = post(client, f"lanes/{lane['id']}/redo")["lanes"]
    assert redone | {"version": take["version"]} == take
    assert redone_new | {"version": new["version"]} == new
    np.testing.assert_array_equal(
        lane_pcm(client, redone, start_time=0.25, samples=1200), signal.T[:1]
    )


def test_stream_failure_closes_a_readable_partial_take(audio, tmp_path):
    client, devices = audio
    signal = np.linspace(-0.25, 0.25, 800, dtype=np.float32)
    with client.websocket_connect("/ws?token=secret") as socket:
        start(client)
        stream = devices.streams[-1]
        stream.feed(np.stack([signal, np.zeros_like(signal)], axis=1))
        event(socket, "record_preview")
        stream.fail()
        assert event(socket, "error")["detail"] == "Audio device stream stopped unexpectedly"
        assert event(socket, "record_state")["state"] == "idle"
    [partial] = (tmp_path / "state" / "recordings").glob("*/*.wav")
    data, sr = sf.read(partial, dtype="float32")
    assert sr == SR and stream.closed
    np.testing.assert_array_equal(data, signal)
    assert client.get("/api/session").json()["lanes"] == []


def test_mixdown_audibility_offset_and_gain(audio, tmp_path):
    client, _ = audio
    level = np.full(4, 0.25, dtype=np.float32)
    original = tmp_path / "a.wav"
    open_wav(client, original, level)
    b = open_wav(client, tmp_path / "b.wav", level)
    c = open_wav(client, tmp_path / "c.wav", np.ones(4, dtype=np.float32))
    b_url = f"/api/lanes/{b['id']}"
    assert client.patch(b_url, json={"offset": 2 / SR, "gain_db": 20 * log10(2)}).is_success
    assert client.patch(f"/api/lanes/{c['id']}", json={"mute": True}).is_success
    output = tmp_path / "mix.wav"
    body = {"t0": 0, "t1": 6 / SR, "sr": SR, "path": str(output), "subtype": "FLOAT"}
    assert post(client, "mixdown", body) == {"path": str(output), "clipping": False}
    np.testing.assert_allclose(
        sf.read(output, dtype="float32")[0], [0.25, 0.25, 0.75, 0.75, 0.5, 0.5]
    )
    assert client.patch(b_url, json={"solo": True}).is_success
    post(client, "mixdown", body)
    np.testing.assert_allclose(sf.read(output, dtype="float32")[0], [0, 0, 0.5, 0.5, 0.5, 0.5])
    assert client.patch(b_url, json={"gain_db": 20 * log10(8)}).is_success
    assert post(client, "mixdown", body)["clipping"]
    np.testing.assert_array_equal(sf.read(output, dtype="float32")[0], [0, 0, 2, 2, 2, 2])
    assert client.post("/api/mixdown", json=body | {"path": str(original)}).status_code == 400
    np.testing.assert_array_equal(sf.read(original, dtype="float32")[0], level)


def test_missing_sounddevice_leaves_authenticated_server_running(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    import_module = builtins.__import__

    def without_sounddevice(name, *args, **kwargs):
        if name == "sounddevice":
            raise OSError("PortAudio library not found")
        return import_module(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", without_sounddevice)
    with TestClient(create_app("secret", "cpu")) as client:
        assert client.get("/api/ping", headers={"Authorization": "Bearer secret"}).is_success
        assert client.get("/api/audio/devices").status_code == 401
        response = client.get("/api/audio/devices", headers={"Authorization": "Bearer secret"})
        assert response.is_success
        assert response.json()["devices"] == []
        assert response.json()["reason"] == "PortAudio library not found"


def test_silent_first_second_reports_microphone_permissions(audio):
    client, devices = audio
    with client.websocket_connect("/ws?token=secret") as socket:
        start(client)
        stream = devices.streams[-1]
        for _ in range(10):
            stream.feed(np.zeros((800, 2), dtype=np.float32))
        assert event(socket, "record_state", "microphone_permission")["state"] == "recording"
        [lane] = post(client, "record/stop")["lanes"]
    assert lane["samples"] == SR


def test_calibration_and_duplex_trim_keep_the_session_origin(audio, tmp_path):
    client, devices = audio
    offset = 0.25
    target = open_wav(client, tmp_path / "target.wav", np.full(80, 0.75, dtype=np.float32))
    backing = open_wav(client, tmp_path / "backing.wav", np.full(80, 0.25, dtype=np.float32))
    for lane in (target, backing):
        assert client.patch(f"/api/lanes/{lane['id']}", json={"offset": offset}).is_success
    mapping = [{"lane": target["id"], "channels": [0]}]
    settings = {"input_device": None, "sr": SR, "blocksize": 80}
    post(client, "record/arm", settings | {"mapping": mapping})
    assert post(client, "record/calibrate", settings | {"output_device": None}) == {
        "latency_ms": 10
    }
    assert devices.streams[-2].closed and devices.streams[-1].active
    assert devices.streams[-2].channels == (1, 1)
    assert not list((tmp_path / "state" / "recordings").glob("*/*.wav"))
    assert len(client.get("/api/session").json()["lanes"]) == 2

    state = start(client, mapping=mapping, blocksize=80, start_time=offset, overdub=True)
    assert state["notice"] == "device_clock_drift"
    stream = devices.streams[-1]
    returned = stream.feed(np.zeros((80, 2), dtype=np.float32))
    np.testing.assert_array_equal(returned, np.full((80, 2), 0.25, dtype=np.float32))
    wanted = np.linspace(-0.5, 0.5, 80, dtype=np.float32)
    tail = stream.feed(np.stack([wanted, np.zeros_like(wanted)], axis=1), underflow=True)
    np.testing.assert_array_equal(tail, np.zeros((80, 2), dtype=np.float32))
    [result] = post(client, "record/stop")["lanes"]
    assert result["id"] == target["id"] and result["offset"] == offset and result["samples"] == 80
    assert result["record_warnings"] == [{"time_s": 0.01, "type": "output_underflow"}]
    np.testing.assert_array_equal(
        lane_pcm(client, result, start_time=offset, samples=80), wanted[None]
    )
