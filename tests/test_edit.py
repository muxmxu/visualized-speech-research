import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from vsr.device import available_devices
from vsr.frame import decode_frame
from vsr.presets import resolve_preset
from vsr.server.app import create_app


@pytest.fixture(params=available_devices())
def client(tmp_path, monkeypatch, request):
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "state"))
    app = create_app("secret", request.param)
    assert app.state.settings["compute_device"] == request.param, app.state.settings
    with TestClient(app, headers={"Authorization": "Bearer secret"}) as live:
        yield live


def open_audio(client, path, audio, sr, offset=0):
    sf.write(path, audio.T, sr, subtype="FLOAT")
    response = client.post("/api/open", json={"paths": [str(path)]})
    assert response.status_code == 200, response.text
    [lane] = response.json()["lanes"]
    moved = client.patch(f"/api/lanes/{lane['id']}", json={"offset": offset})
    assert moved.status_code == 200, moved.text
    return moved.json()


def edit(client, lane, op, start=None, end=None, params=None, channel=None):
    response = client.post(
        f"/api/lanes/{lane['id']}/edit",
        json={"op": op, "t0": start, "t1": end, "params": params or {}, "channel": channel},
    )
    assert response.status_code == 200, response.text
    return response.json()["lanes"]


def history(client, lane, action="undo"):
    response = client.post(f"/api/lanes/{lane['id']}/{action}")
    assert response.status_code == 200, response.text
    return response.json()["lanes"]


def pcm(client, lane):
    response = client.get(
        f"/api/lanes/{lane['id']}/pcm",
        params={
            "t0": lane["offset"],
            "t1": lane["offset"] + lane["samples"] / lane["sr"],
            "sr": lane["sr"],
        },
    )
    assert response.status_code == 200, response.text
    return decode_frame(response.content)[0]


def assert_restored(client, lane, audio):
    np.testing.assert_array_equal(pcm(client, lane).view(np.uint32), audio.view(np.uint32))


@pytest.mark.parametrize(
    ("op", "params"),
    [
        ("cut", {}),
        ("delete", {}),
        ("trim", {}),
        ("copy", {}),
        ("paste", {}),
        ("silence", {}),
        ("insert_silence", {"duration_s": 3 / 16}),
        ("gain", {"gain_db": 20 * np.log10(2)}),
        ("normalize", {"target_dbfs": 20 * np.log10(0.5)}),
        ("fade_in", {"curve": "linear"}),
        ("fade_in", {"curve": "equal-power"}),
        ("fade_out", {"curve": "linear"}),
        ("fade_out", {"curve": "equal-power"}),
        ("invert", {}),
        ("mixdown_channels", {}),
    ],
)
def test_time_edit_and_bitwise_undo(client, tmp_path, op, params):
    audio = np.stack((np.arange(12) / 32, -np.arange(1, 13) / 64)).astype(np.float32)
    lane = open_audio(client, tmp_path / "source.wav", audio, 16, offset=2.25)
    start, end = lane["offset"] + 2.4 / 16, lane["offset"] + 6.8 / 16
    selected = audio[:, 2:7]
    expected = audio.copy()
    if op in {"cut", "delete"}:
        expected = np.concatenate((audio[:, :2], audio[:, 7:]), axis=1)
    elif op == "trim":
        expected = selected
    elif op == "paste":
        assert edit(client, lane, "copy", start, end) == []
        start, end = lane["offset"] + 8 / 16, None
        expected = np.concatenate((audio[:, :8], selected, audio[:, 8:]), axis=1)
    elif op == "insert_silence":
        end = None
        expected = np.concatenate((audio[:, :2], np.zeros((2, 3)), audio[:, 2:]), axis=1)
    elif op == "silence":
        expected[:, 2:7] = 0
    elif op == "gain":
        expected[:, 2:7] = 2 * selected
    elif op == "normalize":
        expected[:, 2:7] = 0.5 * selected / np.abs(selected).max()
    elif op.startswith("fade"):
        ramp = np.linspace(0, 1, 5)
        if op == "fade_out":
            ramp = ramp[::-1]
        if params["curve"] == "equal-power":
            ramp = np.sin(np.pi * ramp / 2)
        expected[:, 2:7] = selected * ramp
    elif op == "invert":
        expected[:, 2:7] = -selected
    elif op == "mixdown_channels":
        start = end = None
        expected = (audio[:1] + audio[1:]) / 2

    changed = edit(client, lane, op, start, end, params)
    if op == "copy":
        assert changed == history(client, lane) == []
        assert client.get("/api/session").json()["lanes"] == [lane]
        assert_restored(client, lane, audio)
        return
    [modified] = changed
    assert modified["version"] == 1 and modified["dirty"]
    if op.startswith("fade") or op == "normalize":
        np.testing.assert_allclose(pcm(client, modified), expected, atol=2**-24, rtol=0)
    else:
        np.testing.assert_array_equal(pcm(client, modified), expected)
    if op == "cut":
        [reinserted] = edit(client, lane, "paste", start)
        assert_restored(client, reinserted, audio)
        [modified] = history(client, lane)
    [restored] = history(client, lane)
    assert restored["version"] == modified["version"] + 1 and not restored["dirty"]
    assert_restored(client, restored, audio)


def test_grouped_edit_history_and_branch(client, tmp_path):
    a, b = (np.arange(10, dtype=np.float32)[None, :] / d for d in (32, 64))
    first = open_audio(client, tmp_path / "first.wav", a, 10, offset=2)
    second = open_audio(client, tmp_path / "second.wav", b, 10, offset=2.2)
    peer = open_audio(client, tmp_path / "peer.wav", b, 10)
    with client.websocket_connect("/ws?token=secret") as socket:
        first_edited, second_edited = edit(
            client,
            first,
            "silence",
            2.3,
            2.7,
            params={"lane_ids": [second["id"]]},
        )
        assert socket.receive_json() == {"type": "lanes_changed"}
    for lane, original, start, end in ((first_edited, a, 3, 7), (second_edited, b, 1, 5)):
        expected = original.copy()
        expected[:, start:end] = 0
        assert_restored(client, lane, expected)
    first_restored, second_restored = history(client, peer)
    assert_restored(client, first_restored, a)
    assert_restored(client, second_restored, b)
    first_redone, second_redone = history(client, peer, "redo")
    for lane, prior in ((first_redone, first_edited), (second_redone, second_edited)):
        assert lane["version"] == 3 and lane["dirty"] and lane["id"] == prior["id"]
    np.testing.assert_array_equal(pcm(client, first_redone)[:, 3:7], 0)
    np.testing.assert_array_equal(pcm(client, second_redone)[:, 1:5], 0)
    history(client, peer)
    edit(client, second, "invert")
    assert history(client, first, "redo") == []


def mask_parameters(preset, sr):
    resolved = resolve_preset(preset, sr)
    return {name: resolved[name] for name in ("n_fft", "win_length", "window")} | {
        "window_param": resolved.get("window_param", 0),
        "f_lo": 500,
        "f_hi": 1500,
    }


def amplitude(data, sr, frequency):
    phase = -2j * np.pi * frequency * np.arange(len(data)) / sr
    return 2 * abs(data @ np.exp(phase)) / len(data)


@pytest.mark.parametrize("preset", ["analysis", "wideband", "narrowband"])
def test_spectral_attenuation_presets(client, tmp_path, preset):
    sr = 16_000
    time = np.arange(2 * sr) / sr
    tones = np.array([0.25 * np.sin(2 * np.pi * freq * time) for freq in (1000, 4000)])
    audio = np.stack((tones.sum(axis=0), tones[0])).astype(np.float32)
    lane = open_audio(client, tmp_path / "tone.wav", audio, sr, offset=1)
    params = mask_parameters(preset, sr)
    [changed] = edit(client, lane, "spectral_attenuate", 1.25, 2.75, params | {"gain_db": -20}, 0)
    actual = pcm(client, changed)
    first, last = sr // 4 - params["n_fft"], 7 * sr // 4 + params["n_fft"]
    np.testing.assert_array_equal(actual[:, :first], audio[:, :first])
    np.testing.assert_array_equal(actual[:, last:], audio[:, last:])
    np.testing.assert_array_equal(actual[1], audio[1])
    central = actual[0, sr // 2 : 3 * sr // 2]
    inside, outside = (20 * np.log10(amplitude(central, sr, f) / 0.25) for f in (1000, 4000))
    assert -21 <= inside <= -19
    assert abs(outside) < 0.5
    [restored] = history(client, lane)
    assert_restored(client, restored, audio)


@pytest.mark.parametrize("spectral", [False, True], ids=["time", "time-frequency"])
def test_extract_alignment_and_undo(client, tmp_path, spectral):
    sr = 16_000
    time = np.arange(sr) / sr
    tone = 0.25 * np.sin(2 * np.pi * 1000 * time)
    other = 0.25 * np.sin(2 * np.pi * 4000 * time)
    audio = np.stack((tone + other, other)).astype(np.float32)
    lane = open_audio(client, tmp_path / "source.wav", audio, sr, offset=3)
    start, end = 3.25, 3.75
    params = mask_parameters("analysis", sr) if spectral else {}
    [created] = edit(client, lane, "spectral_extract", start, end, params, 0 if spectral else None)
    assert created["offset"] == start and created["samples"] == sr // 2 and created["dirty"]
    samples = pcm(client, created)
    if spectral:
        interior = slice(sr // 8, 3 * sr // 8)
        shifted_tone = tone[sr // 4 : 3 * sr // 4]
        np.testing.assert_allclose(samples[0, interior], shifted_tone[interior], atol=1e-5, rtol=0)
    else:
        np.testing.assert_array_equal(samples, audio[:, sr // 4 : 3 * sr // 4])
    assert client.get("/api/session").json()["lanes"] == [lane, created]
    assert_restored(client, lane, audio)
    assert history(client, lane) == []
    assert client.get("/api/session").json()["lanes"] == [lane]
    [redone] = history(client, lane, "redo")
    assert redone["id"] == created["id"] and redone["version"] > created["version"]
    np.testing.assert_array_equal(pcm(client, redone), samples)
    assert_restored(client, lane, audio)
