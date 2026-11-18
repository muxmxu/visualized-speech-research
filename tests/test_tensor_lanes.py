import json
import math
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf
import torch
from fastapi.testclient import TestClient

from vsr.frame import decode_frame, encode_frame
from vsr.server.app import create_app
from vsr.server.ws import Connections

HEADERS = {"Authorization": "Bearer secret"}
LAUNCH = "X-VSR-Open-Launch"
AUDIO = {"kind": "audio", "layout": "[N]", "sr": 8000}
FEATURE = {
    "kind": "feature",
    "axes": "[F,T]",
    "sr": 8000,
    "hop": 80,
    "freq_axis": {"type": "index"},
    "value_scale": "raw",
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    with TestClient(create_app("secret", "cpu")) as client:
        yield client


def inspect_file(client, path):
    response = client.post("/api/open", headers=HEADERS, json={"paths": [str(path)]})
    assert response.status_code == 200, response.text
    return response.json()


def open_tensor(client, path, interpretation, key_path=()):
    return client.post(
        "/api/open_tensor",
        headers=HEADERS,
        json={"path": str(path), "interpretation": interpretation, "key_path": list(key_path)},
    )


def lanes(response):
    assert response.status_code == 200, response.text
    result = response.json()["lanes"]
    assert all("data" not in lane for lane in result)
    return result


def session(client):
    return lanes(client.get("/api/session", headers=HEADERS))


def push_frame(array, interpretation, name="training"):
    args = {k: v for k, v in interpretation.items() if k not in {"kind", "sr"}}
    return encode_frame(
        array,
        {
            "name": name,
            "kind": interpretation["kind"],
            "sr": interpretation["sr"],
            "interpretation": args,
        },
    )


def pcm(client, lane):
    sr = lane["sr"]
    response = client.get(
        f"/api/lanes/{lane['id']}/pcm",
        headers=HEADERS,
        params={"t0": 0, "t1": lane["samples"] / sr, "sr": sr},
    )
    assert response.status_code == 200, response.text
    return decode_frame(response.content)[0]


def view(client, lane, **changes):
    params = {"t0": 0, "t1": 1, "width": 100, "f_lo": 0, "f_hi": 1} | changes
    response = client.get(f"/api/lanes/{lane['id']}/spectrogram", headers=HEADERS, params=params)
    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "no-store"
    return decode_frame(response.content)


def rejected(response, detail=None, status=422):
    assert response.status_code == status, response.text
    problem = response.json()
    assert set(problem) == {"error", "detail", "traceback"}
    assert isinstance(problem["error"], str)
    assert isinstance(problem["detail"], str)
    assert problem["traceback"] is None
    if detail:
        assert detail in problem["detail"]


def launch_open(client, value, *paths):
    return client.post("/api/open", headers=HEADERS | {LAUNCH: value}, json={"paths": paths})


def stage_launch(client, *paths):
    response = launch_open(client, "stage", *paths)
    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "no-store"
    identifier = response.json()["launch_id"]
    assert re.fullmatch(r"[A-Za-z0-9_-]{43}", identifier)
    return identifier


def test_open_launch_preserves_order_and_redeems_only_once(client, tmp_path):
    audio = str(tmp_path / "tone.wav")
    first, second = str(tmp_path / "first.npy"), str(tmp_path / "second.npy")
    mixed = stage_launch(client, second, audio, first, audio, second)
    single = stage_launch(client, first)
    tensors = stage_launch(client, second, first)
    assert session(client) == []
    sf.write(audio, np.zeros(800, dtype=np.float32), 8000)
    np.save(first, np.zeros(8, dtype=np.float32))
    np.save(second, np.zeros(16, dtype=np.float32))

    assert client.post("/api/open", headers=HEADERS, json={"paths": []}).json() == {"lanes": []}
    one = inspect_file(client, first)
    two = inspect_file(client, second)
    rejected(client.post("/api/open", headers=HEADERS, json={"paths": [audio, first]}), status=400)
    assert (
        client.post("/api/open", headers={LAUNCH: "stage"}, json={"paths": [first]}).status_code
        == 401
    )
    assert client.post("/api/open", headers={LAUNCH: mixed}, json={"paths": []}).status_code == 401
    rejected(launch_open(client, "stage", "relative.npy"))
    rejected(launch_open(client, "stage", audio))
    rejected(launch_open(client, "invalid"))
    rejected(launch_open(client, mixed, first))
    duplicate = [*HEADERS.items(), (LAUNCH, mixed), (LAUNCH, mixed)]
    rejected(client.post("/api/open", headers=duplicate, json={"paths": []}))

    assert len({mixed, single, tensors}) == 3
    assert launch_open(client, tensors).json() == {"lanes": [], "interpretations": [two, one]}
    assert launch_open(client, single).json() == one
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(
            workers.map(lambda identifier: launch_open(client, identifier), [mixed, mixed])
        )
    success, replay = sorted(results, key=lambda response: response.status_code)
    assert success.headers["Cache-Control"] == "no-store"
    assert success.json()["interpretations"] == [two, one, two]
    assert [lane["source"] for lane in lanes(success)] == [audio, audio]
    assert session(client) == lanes(success)
    rejected(replay, status=404)

    broken = stage_launch(client, audio, str(tmp_path / "broken.npy"))
    rejected(launch_open(client, broken))
    assert session(client) == lanes(success)
    rejected(launch_open(client, broken), status=404)


def test_open_launch_reclaims_expired_capacity(client, tmp_path, monkeypatch):
    now = 1.0
    monkeypatch.setattr("vsr.server.app.monotonic", lambda: now)
    path = str(tmp_path / "signal.npy")
    np.save(path, np.zeros(4, dtype=np.float32))
    earliest = stage_launch(client, path)
    now += 1
    live = [stage_launch(client, path) for _ in range(63)]
    rejected(launch_open(client, "stage", path), status=429)
    now += 299
    rejected(launch_open(client, earliest), status=404)
    stage_launch(client, path)
    rejected(launch_open(client, "stage", path), status=429)
    assert launch_open(client, live[0]).json() == inspect_file(client, path)


@pytest.mark.parametrize("ext", ["pt", "pth", "npy", "npz", "safetensors"])
@pytest.mark.parametrize("dtype", [np.int16, np.float32])
def test_file_formats_read_back_original_amplitudes(client, tmp_path, ext, dtype):
    path = tmp_path / f"signal.{ext}"
    data = np.array([-16384, 16384] if dtype == np.int16 else [-0.75, 0.125], dtype=dtype)
    if ext in {"pt", "pth"}:
        torch.save([{"wav": (torch.from_numpy(data), "metadata")}], path)
        key_path = [0, "wav", 0]
    elif ext == "npy":
        np.save(path, data)
        key_path = []
    elif ext == "npz":
        np.savez(path, wav=data)
        key_path = ["wav"]
    else:
        safe = pytest.importorskip("safetensors.torch", reason="safetensors is an optional extra")
        safe.save_file({"wav": torch.from_numpy(data)}, path)
        key_path = ["wav"]

    original = path.read_bytes()
    assert inspect_file(client, path) == {
        "needs_interpretation": True,
        "path": str(path),
        "tree": [{"key_path": key_path, "shape": [2], "dtype": data.dtype.name}],
    }
    assert session(client) == []
    [lane] = lanes(open_tensor(client, path, AUDIO, key_path))
    expected = [-0.5, 0.5] if dtype == np.int16 else [-0.75, 0.125]
    np.testing.assert_array_equal(pcm(client, lane), [expected])
    assert lane["source"] == str(path)
    assert path.read_bytes() == original


def test_reversible_leaf_paths(client, tmp_path):
    path = tmp_path / "nested.pth"
    torch.save(
        {
            "0": [torch.tensor([0.25])],
            0: ({"a.b": torch.tensor([0.5])},),
            ("layer", 3): torch.tensor([0.75]),
        },
        path,
    )
    tree = inspect_file(client, path)["tree"]
    assert [leaf["key_path"] for leaf in tree] == [["0", 0], [0, 0, "a.b"], [["layer", 3]]]
    for leaf, value in zip(tree, [0.25, 0.5, 0.75], strict=True):
        [lane] = lanes(open_tensor(client, path, AUDIO, leaf["key_path"]))
        np.testing.assert_array_equal(pcm(client, lane), [[value]])


@pytest.mark.parametrize(
    ("layout", "shape", "expected"),
    [
        ("[N]", (3,), [[[0, 1, 2]]]),
        ("[C,N]", (2, 3), [[[0, 1, 2], [3, 4, 5]]]),
        ("[N,C]", (3, 2), [[[0, 2, 4], [1, 3, 5]]]),
        ("[B,N]", (2, 3), [[[0, 1, 2]], [[3, 4, 5]]]),
        ("[B,C,N]", (2, 2, 3), [[[0, 1, 2], [3, 4, 5]], [[6, 7, 8], [9, 10, 11]]]),
    ],
)
def test_audio_layouts(client, tmp_path, layout, shape, expected):
    path = tmp_path / "layout.npy"
    np.save(path, np.arange(math.prod(shape), dtype=np.float32).reshape(shape) / 16)
    opened = lanes(open_tensor(client, path, AUDIO | {"layout": layout}))
    for lane, values in zip(opened, expected, strict=True):
        assert (lane["channels"], lane["samples"]) == np.shape(values)
        np.testing.assert_array_equal(pcm(client, lane), np.array(values) / 16)


@pytest.mark.parametrize(
    ("axes", "order", "batched"),
    [
        ("[F,T]", (0, 1), False),
        ("[T,F]", (1, 0), False),
        ("[B,F,T]", (0, 1, 2), True),
        ("[B,T,F]", (0, 2, 1), True),
    ],
)
def test_feature_axes(client, tmp_path, axes, order, batched):
    path = tmp_path / "axes.npy"
    canonical = np.arange(24, dtype=np.float32).reshape(2, 3, 4)
    batch = canonical if batched else canonical[:1]
    np.save(path, (batch if batched else batch[0]).transpose(order))
    opened = lanes(open_tensor(client, path, FEATURE | {"axes": axes}))
    for lane, expected in zip(opened, batch, strict=True):
        assert (lane["rows"], lane["frames"], lane["frame_rate"]) == (3, 4, 100)
        assert lane["frame_t0"] == 0
        values, header = view(client, lane, f_hi=2)
        assert header["row_freqs"] == [0, 1, 2]
        np.testing.assert_array_equal(values, expected)


@pytest.mark.parametrize(
    ("scale", "input_value", "display"),
    [
        ("magnitude", 0.1, -20),
        ("power", 0.01, -20),
        ("db", -20, -20),
        ("ln_magnitude", math.log(0.1), -20),
        ("log10_magnitude", -1, -20),
        ("raw", 7, 7),
        ("magnitude", 0, -200),
        ("power", 0, -200),
    ],
)
def test_feature_scales(client, tmp_path, scale, input_value, display):
    path = tmp_path / "scale.npy"
    np.save(path, np.full((1, 2), input_value, dtype=np.float32))
    [lane] = lanes(open_tensor(client, path, FEATURE | {"value_scale": scale}))
    result, header = view(client, lane, f_hi=0)
    assert lane["value_scale"] == scale
    assert result.dtype == (np.float32 if scale == "raw" else np.float16)
    assert header["view_db_max"] == display
    assert header["lane_db_max"] == pytest.approx(display, abs=3e-5)
    np.testing.assert_array_equal(result, [[display, display]])


def test_complex_feature_is_magnitude(client, tmp_path):
    path = tmp_path / "complex.npy"
    np.save(path, np.full((2, 3), 3 + 4j, dtype=np.complex64))
    [lane] = lanes(open_tensor(client, path, FEATURE))
    result, header = view(client, lane)
    assert lane["value_scale"] == "magnitude"
    np.testing.assert_array_equal(result, np.full((2, 3), 20 * math.log10(5), dtype=np.float16))
    assert header["lane_db_max"] == pytest.approx(20 * math.log10(5), abs=3e-5)


@pytest.mark.parametrize(
    "axis",
    [
        {"type": "index"},
        {"type": "linear", "f_max": 6000},
        {"type": "mel", "n_mels": 4, "fmin": 0, "fmax": 4000, "htk": True},
    ],
)
def test_feature_view_uses_absolute_time_groups_and_labels(client, tmp_path, axis):
    from librosa import mel_frequencies

    path = tmp_path / "absolute.npy"
    data = np.arange(32, dtype=np.float32).reshape(4, 8)
    np.save(path, data)
    [lane] = lanes(open_tensor(client, path, FEATURE | {"freq_axis": axis}))
    patched = client.patch(f"/api/lanes/{lane['id']}", headers=HEADERS, json={"offset": 1.25})
    assert patched.status_code == 200
    with client.app.state.session.lock:
        client.app.state.session.lane(lane["id"]).frame_t0 = 0.005
    result, header = view(
        client,
        lane,
        t0=1.264,
        t1=1.306,
        width=3,
        height=1,
        f_lo=1,
        f_hi=3,
        mode="ignored",
        n_fft="ignored",
        channel=-1,
    )
    np.testing.assert_array_equal(result, [[9, 11, 13], [17, 19, 21], [25, 27, 29]])
    assert header["col_t0"] == pytest.approx(1.26)
    assert header["col_dt"] == pytest.approx(0.02)
    assert header["lane_db_max"] == 31
    assert header["view_db_max"] == 29
    assert header["f_axis"] == {"scale": axis["type"], "lo": 1, "hi": 3}
    match axis["type"]:
        case "linear":
            labels = [2000, 4000, 6000]
        case "mel":
            labels = mel_frequencies(6, fmin=0, fmax=4000, htk=True)[2:-1]
        case "index":
            labels = [1, 2, 3]
    np.testing.assert_allclose(header["row_freqs"], labels, rtol=1e-7)
    empty, empty_meta = view(client, lane, t0=2, t1=3)
    assert empty.shape == (2, 0)
    assert empty_meta["view_db_max"] is None


def test_upload_auth_and_audio_routes_guard_features(client, tmp_path):
    path = tmp_path / "upload.npy"
    np.save(path, np.arange(9, dtype=np.float32).reshape(3, 3))
    ignore = tmp_path / "ignore.txt"
    ignore.touch()
    listing = client.get("/api/fs/list", headers=HEADERS, params={"path": str(tmp_path)}).json()
    assert [row["name"] for row in listing["entries"]] == ["upload.npy"]
    request = {"content": path.read_bytes(), "params": {"name": "tensor.npy"}}
    assert client.post("/api/upload", **request).status_code == 401
    assert client.post("/api/open", json={"paths": [str(path)]}).status_code == 401
    assert client.post("/api/open_tensor", json={}).status_code == 401
    assert client.post("/api/push", content=b"").status_code == 401
    response = client.post("/api/upload", **request, headers=HEADERS)
    assert response.status_code == 200
    reply = response.json()
    saved = Path(reply["path"])
    assert saved.parent.parent == tmp_path / "uploads"
    assert set(reply) == {"needs_interpretation", "path", "tree"}
    assert reply["needs_interpretation"] is True
    assert reply["tree"] == [{"key_path": [], "shape": [3, 3], "dtype": "float32"}]
    [lane] = lanes(open_tensor(client, saved, FEATURE))
    assert lane["source"] == "upload:tensor.npy"
    assert saved.read_bytes() == path.read_bytes()
    assert client.get(f"/api/lanes/{lane['id']}/spectrogram").status_code == 401
    prefix = f"/api/lanes/{lane['id']}"
    rejected(client.get(f"{prefix}/waveform", headers=HEADERS, params={"t0": 0, "t1": 1}), "audio")
    rejected(
        client.get(f"{prefix}/pcm", headers=HEADERS, params={"t0": 0, "t1": 1, "sr": 8000}),
        "audio",
    )
    rejected(
        client.post(
            f"{prefix}/spectrum",
            headers=HEADERS,
            json=dict(
                t0=0,
                t1=1,
                channel=0,
                method="frame",
                n_fft=16,
                win_length=16,
                hop=4,
                window="hann",
                window_param=0,
                stats=["mean"],
                unit="dbfs",
                active_only=False,
            ),
        ),
        "audio",
    )
    rejected(
        client.get(
            f"{prefix}/spectrogram",
            headers=HEADERS,
            params={"t0": 0, "t1": 1, "width": 1, "f_lo": 0.5, "f_hi": 1},
        ),
        "integer row indices",
    )


class InertObject:
    """Fixture containing an unsupported Python class with no custom serialization."""


def test_unsafe_files_rejected_and_audio_batch_preserved(client, tmp_path):
    obj = tmp_path / "inert.pt"
    torch.save({"leaf": torch.tensor([0.5]), "other": InertObject()}, obj)
    obj_array = tmp_path / "objects.npy"
    np.save(obj_array, np.array(["ordinary"], dtype=object))
    obj_archive = tmp_path / "objects.npz"
    np.savez(obj_archive, allowed=np.ones(2), rejected=np.array(["ordinary"], dtype=object))
    for path, message in [
        (obj, "weights-only"),
        (obj_array, "Object arrays"),
        (obj_archive, "Object arrays"),
    ]:
        original = path.read_bytes()
        rejected(client.post("/api/open", headers=HEADERS, json={"paths": [str(path)]}), message)
        rejected(open_tensor(client, path, AUDIO), message)
        assert path.read_bytes() == original
        assert session(client) == []

    audio_files = [tmp_path / name for name in ("first.wav", "second.wav")]
    for path in audio_files:
        sf.write(path, np.zeros(2, dtype=np.float32), 8000)
    bad_path = tmp_path / "unsupported.txt"
    rejected(
        client.post(
            "/api/open", headers=HEADERS, json={"paths": [str(audio_files[0]), str(bad_path)]}
        ),
        status=400,
    )
    assert session(client) == []
    reply = client.post("/api/open", headers=HEADERS, json={"paths": list(map(str, audio_files))})
    assert [lane["name"] for lane in lanes(reply)] == ["first.wav", "second.wav"]


@pytest.mark.parametrize(
    ("interpretation", "key"),
    [
        (AUDIO | {"sr": 0}, []),
        (AUDIO | {"sr": "bad"}, []),
        (AUDIO | {"layout": "[B,C,N]"}, []),
        (FEATURE | {"axes": "[X,Y]"}, []),
        (FEATURE | {"hop": 0}, []),
        (FEATURE | {"value_scale": "unsupported"}, []),
        (FEATURE | {"freq_axis": {"type": "linear", "f_max": -1}}, []),
        (
            FEATURE
            | {"freq_axis": {"type": "mel", "n_mels": 4, "fmin": 3, "fmax": 2, "htk": False}},
            [],
        ),
        (
            FEATURE
            | {"freq_axis": {"type": "mel", "n_mels": 4, "fmin": 0, "fmax": 200, "htk": False}},
            [],
        ),
        (FEATURE, ["missing"]),
    ],
)
def test_invalid_interpretations_leave_session_unchanged(client, tmp_path, interpretation, key):
    path = tmp_path / "validate.npy"
    np.save(path, np.ones((2, 3), dtype=np.float32))
    existing = lanes(open_tensor(client, path, FEATURE))
    rejected(open_tensor(client, path, interpretation, key))
    assert session(client) == existing


def test_batch_limit_atomic_publish_and_single_notification(client, tmp_path, monkeypatch):
    path = tmp_path / "batch.npy"
    broadcast = Connections.broadcast
    noticed = []

    async def count_broadcast(self):
        session_state = client.app.state.session
        with session_state.lock:
            noticed.append(len(session_state.lanes))
        await broadcast(self)

    monkeypatch.setattr(Connections, "broadcast", count_broadcast)
    np.save(path, np.zeros((33, 2), dtype=np.float32))
    interpret = AUDIO | {"layout": "[B,N]"}
    with client.websocket_connect("/ws?token=secret") as socket:
        rejected(open_tensor(client, path, interpret), "at most 32")
        rejected(
            client.post(
                "/api/push",
                headers=HEADERS,
                content=push_frame(
                    np.zeros((33, 2, 2), dtype=np.float32), FEATURE | {"axes": "[B,F,T]"}
                ),
            ),
            "at most 32",
        )
        assert session(client) == []
        assert noticed == []
        np.save(path, np.arange(64, dtype=np.float32).reshape(32, 2) / 64)
        opened = lanes(open_tensor(client, path, interpret))
        assert len(opened) == 32
        assert socket.receive_json() == {"type": "lanes_changed"}
        assert noticed == [32]
        assert session(client) == opened
        assert len({lane["id"] for lane in opened}) == 32


def test_push_shares_audio_and_feature_interpretation(client):
    audio = np.array([-0.5, 0.625], dtype=np.float32)
    [lane] = lanes(client.post("/api/push", headers=HEADERS, content=push_frame(audio, AUDIO)))
    assert lane["source"] == "push:training"
    np.testing.assert_array_equal(pcm(client, lane), [audio])
    integers = np.array([-16384, 16384], dtype=np.int16)
    [int_lane] = lanes(
        client.post("/api/push", headers=HEADERS, content=push_frame(integers, AUDIO))
    )
    np.testing.assert_array_equal(pcm(client, int_lane), [[-0.5, 0.5]])
    feature = np.arange(8, dtype=np.float32).reshape(4, 2)
    [feat_lane] = lanes(
        client.post(
            "/api/push", headers=HEADERS, content=push_frame(feature, FEATURE | {"axes": "[T,F]"})
        )
    )
    assert feat_lane["frame_rate"] == 100
    np.testing.assert_array_equal(view(client, feat_lane)[0], feature.T)
    good = push_frame(audio, AUDIO)
    for content in (
        b"bad",
        good[:-1],
        good + b"\0",
        push_frame({"only": audio}, AUDIO),
        push_frame(audio, AUDIO | {"sr": 0}),
    ):
        rejected(client.post("/api/push", headers=HEADERS, content=content))
    assert session(client) == [lane, int_lane, feat_lane]


@pytest.mark.parametrize("budget", [200000, 8])
def test_mel_rows_pooling_calibration_and_cache_keys(tmp_path, monkeypatch, budget):
    from librosa import mel_frequencies
    from librosa.feature import melspectrogram

    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    (tmp_path / "config.toml").write_text(f"cache_bytes = {budget}\n")
    sr = 256
    samples = (np.random.default_rng(82).standard_normal(4092) * 0.1).astype(np.float32)
    path = tmp_path / "mel.wav"
    sf.write(path, samples, sr, subtype="FLOAT")
    app = create_app("secret", "cpu", [str(path)])
    with TestClient(app) as mel_client:
        [lane] = session(mel_client)
        query = dict(
            height=1,
            f_hi=128,
            yscale="linear",
            channel=0,
            mode="mel",
            n_fft=32,
            win_length=32,
            hop=4,
            window="hann",
            window_param=0,
            n_mels=4,
            fmin=0,
            fmax=128,
            htk=False,
        )
        power = (
            melspectrogram(
                y=samples,
                sr=sr,
                n_fft=32,
                win_length=32,
                hop_length=4,
                window="hann",
                center=True,
                pad_mode="constant",
                power=2,
                n_mels=4,
                fmin=0,
                fmax=128,
                htk=False,
            )
            / 64
        )
        db = 10 * np.log10(np.maximum(power, 1e-20))
        expected_frequencies = mel_frequencies(6, fmin=0, fmax=128)[1:-1]
        for width, p in ((128, 8), (16, 64)):
            full, header = view(mel_client, lane, **query, t1=16, width=width)
            expected = db.astype(np.float16).reshape(4, -1, p).max(axis=-1)
            np.testing.assert_array_less(np.abs(full - expected), 2 * np.abs(np.spacing(expected)))
            np.testing.assert_allclose(header["row_freqs"], expected_frequencies, rtol=1e-7)
            assert full.shape == (4, 1024 // p)
            assert header["col_t0"] == (p - 1) / 128
            assert header["col_dt"] == p / 64
            assert header["lane_db_max"] == pytest.approx(db.max(), abs=3e-5)

        spectral_cache = app.state.session.cache
        assert len(spectral_cache) == 1
        base, p8, p64, _, _ = next(iter(spectral_cache.values()))
        if budget == 8:
            assert (base, p8, p64) == (None, None, None)
        else:
            assert (base.shape, p8.shape, p64.shape) == ((4, 1024), (4, 128), (4, 16))
        sliced, meta = view(
            mel_client, lane, **(query | {"f_lo": 40, "f_hi": 90, "t0": 0.08, "t1": 0.14})
        )
        assert sliced.shape == (2, 3)
        np.testing.assert_allclose(meta["row_freqs"], expected_frequencies[1:3], rtol=1e-7)
        if budget != 8:
            assert len(spectral_cache) == 1
            stft, _ = view(mel_client, lane, **(query | {"mode": "stft", "height": 50}))
            assert stft.shape[0] == 17
            for change in ({"n_mels": 5}, {"fmin": 8}, {"fmax": 120}, {"htk": True}):
                view(mel_client, lane, **(query | change))
            assert len(spectral_cache) == 6


@pytest.mark.parametrize("transport", ["file", "push"])
def test_uint8_offset_binary_pcm(client, tmp_path, transport):
    samples = np.array([0, 64, 128, 192, 255], dtype=np.uint8)
    if transport == "file":
        path = tmp_path / "offset-binary.npy"
        np.save(path, samples)
        response = open_tensor(client, path, AUDIO)
    else:
        response = client.post("/api/push", headers=HEADERS, content=push_frame(samples, AUDIO))
    [lane] = lanes(response)
    np.testing.assert_array_equal(pcm(client, lane), [[-1, -0.5, 0, 0.5, 127 / 128]])


@pytest.mark.parametrize(("dtype", "bits"), [(np.uint32, 32), (np.uint64, 64)])
def test_wide_unsigned_pcm_preserves_midpoint_neighbors(client, tmp_path, dtype, bits):
    midpoint = 2 ** (bits - 1)
    path = tmp_path / "offset-binary-wide.npy"
    np.save(path, np.array([midpoint - 1, midpoint, midpoint + 1], dtype=dtype))
    [leaf] = inspect_file(client, path)["tree"]
    [lane] = lanes(open_tensor(client, path, AUDIO, leaf["key_path"]))
    result = pcm(client, lane)
    step = 2.0 ** (1 - bits)
    assert result.dtype == np.float32
    np.testing.assert_array_equal(result, np.array([[-step, 0, step]], dtype=np.float32))


@pytest.mark.parametrize(
    "keys",
    [
        [2**53, 2**53 + 1, str(2**53 + 1), "normal", 2],
        [b"\x00\xff", b"other", "00ff", ("key", b"id", 2**53 + 1), ("key", "id", 1)],
    ],
    ids=["large-integers", "bytes"],
)
def test_browser_safe_leaf_paths(client, tmp_path, keys):
    path = tmp_path / "key-types.pt"
    signals = [0.125, 0.25, 0.375, 0.5, 0.625]
    torch.save(
        {key: torch.tensor([signal]) for key, signal in zip(keys, signals, strict=True)}, path
    )
    response = client.post("/api/open", headers=HEADERS, json={"paths": [str(path)]})
    assert response.status_code == 200, response.text
    # Browser JSON decodes all bare numbers as IEEE-754 double precision values.
    reported = json.loads(response.content, parse_int=float)
    paths = [leaf["key_path"] for leaf in reported["tree"]]
    assert len({json.dumps(path, sort_keys=True) for path in paths}) == len(signals)
    for key_path, signal in zip(paths, signals, strict=True):
        [lane] = lanes(open_tensor(client, path, AUDIO, key_path))
        np.testing.assert_array_equal(pcm(client, lane), [[signal]])


def test_feature_first_partial_pool_center(client, tmp_path):
    path = tmp_path / "seven-frames.npy"
    np.save(path, np.arange(7, dtype=np.float32).reshape(1, 7))
    [lane] = lanes(open_tensor(client, path, FEATURE))
    data, header = view(client, lane, t0=0.04, t1=0.06, width=1, f_hi=0)
    np.testing.assert_array_equal(data, [[6]])
    assert header["col_t0"] == pytest.approx(0.05)
    assert header["col_dt"] == pytest.approx(0.04)


def test_mel_first_partial_pool_center(client, tmp_path):
    path = tmp_path / "seven-mel-frames.wav"
    sf.write(path, np.ones(24, dtype=np.float32) / 2, 8000, subtype="FLOAT")
    [lane] = lanes(client.post("/api/open", headers=HEADERS, json={"paths": [str(path)]}))
    data, header = view(
        client,
        lane,
        t0=0.002,
        t1=0.003,
        width=1,
        f_hi=4000,
        height=1,
        yscale="linear",
        channel=0,
        mode="mel",
        n_fft=16,
        win_length=16,
        hop=4,
        window="hann",
        window_param=0,
        n_mels=2,
        fmin=0,
        fmax=4000,
        htk=False,
    )
    assert data.shape == (2, 1)
    assert header["col_t0"] == pytest.approx(0.0025)
    assert header["col_dt"] == pytest.approx(0.002)


def test_raw_feature_preserves_values_outside_half_precision(client, tmp_path):
    path = tmp_path / "raw.npy"
    np.save(path, np.array([[70000, -80000, 0.125]], dtype=np.float32))
    [lane] = lanes(open_tensor(client, path, FEATURE))
    data, header = view(client, lane, f_hi=0)
    assert data.dtype == np.float32
    assert header["view_db_max"] == header["lane_db_max"] == 70000
    np.testing.assert_array_equal(data, [[70000, -80000, 0.125]])


@pytest.mark.parametrize(
    ("scale", "overflow"),
    [("db", 70000), ("db", -70000), ("ln_magnitude", 12000), ("log10_magnitude", 10000)],
)
def test_unrepresentable_feature_batch_keeps_published_lanes(client, scale, overflow):
    existing = lanes(
        client.post(
            "/api/push",
            headers=HEADERS,
            content=push_frame(np.zeros((1, 2), dtype=np.float32), FEATURE),
        )
    )
    batch = np.array([[[0, 1]], [[0, overflow]]], dtype=np.float32)
    params = FEATURE | {"axes": "[B,F,T]", "value_scale": scale}
    rejected(
        client.post("/api/push", headers=HEADERS, content=push_frame(batch, params)),
        "float16",
    )
    assert session(client) == existing
