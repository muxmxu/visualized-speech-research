import json
import os
import select
import socket
import subprocess
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from textwrap import dedent
from threading import Thread

import httpx
import numpy as np
import pytest

from vsr.frame import decode_frame

SR = 8000


def _env(path):
    env = os.environ | {"VSR_HOME": str(path), "MPLBACKEND": "Agg"}
    env.pop("VSR_URL", None)
    env.pop("VSR_TOKEN", None)
    return env


def _sender(env, script):
    return subprocess.run(
        [sys.executable, "-c", dedent(script)], env=env, capture_output=True, text=True, timeout=30
    )


@pytest.fixture
def server(tmp_path):
    env = _env(tmp_path)
    log = tmp_path / "server.log"
    with log.open("wb") as output:
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "vsr.cli",
                "serve",
                "--port",
                "0",
                "--no-browser",
                "--device",
                "cpu",
            ],
            env=env,
            stdout=output,
            stderr=subprocess.STDOUT,
        )
        try:
            deadline = time.monotonic() + 30
            while "Application startup complete." not in log.read_text():
                assert process.poll() is None and time.monotonic() < deadline, log.read_text()
                time.sleep(0.05)
            runtime = json.loads((tmp_path / "runtime.json").read_text())
            url = f"http://127.0.0.1:{runtime['port']}"
            with httpx.Client(
                base_url=url,
                headers={"Authorization": f"Bearer {runtime['token']}"},
                trust_env=False,
            ) as client:
                yield client, env, runtime["token"], log
        finally:
            process.terminate()
            process.wait(timeout=10)


def _get_lanes(client):
    return client.get("/api/session").raise_for_status().json()["lanes"]


def _pcm(client, lane):
    response = client.get(
        f"/api/lanes/{lane['id']}/pcm",
        params={"t0": 0, "t1": lane["samples"] / SR, "sr": SR},
    ).raise_for_status()
    data, meta = decode_frame(response.content)
    assert meta["dtype"] == "f32"
    return data


def test_show_audio_matches_tensor_file_pcm(server, tmp_path):
    client, env, _, _ = server
    sent = _sender(
        env,
        """
        import numpy as np
        import torch
        import vsr

        vsr.show(torch.tensor([-16384, 16384], dtype=torch.int16), sr=8000, name="int16 prediction")
        floats = np.array([-1.25, 0, 0.375, 0], dtype=np.float32)[::2]
        vsr.show(floats, sr=8000, name="float prediction")
        midpoint = 2**63
        unsigned = np.array([midpoint - 1, midpoint, midpoint + 1], dtype=np.uint64)
        vsr.show(unsigned, sr=8000, name="wide unsigned prediction")
        """,
    )
    assert sent.returncode == 0, sent.stderr

    lanes = _get_lanes(client)
    assert [lane["name"] for lane in lanes] == [
        "int16 prediction",
        "float prediction",
        "wide unsigned prediction",
    ]
    assert [(lane["kind"], lane["sr"], lane["channels"], lane["samples"]) for lane in lanes] == [
        ("audio", SR, 1, 2),
        ("audio", SR, 1, 2),
        ("audio", SR, 1, 3),
    ]
    midpoint = 2**63
    inputs_and_pcm = (
        (np.array([-16384, 16384], dtype=np.int16), [-0.5, 0.5]),
        (np.array([-1.25, 0.375], dtype=np.float32), [-1.25, 0.375]),
        (
            np.array([midpoint - 1, midpoint, midpoint + 1], dtype=np.uint64),
            [-(2.0**-63), 0, 2.0**-63],
        ),
    )
    for lane, (samples, expected) in zip(lanes, inputs_and_pcm, strict=True):
        path = tmp_path / f"{samples.dtype}.npy"
        np.save(path, samples)
        tree = client.post("/api/open", json={"paths": [str(path)]}).raise_for_status().json()
        [opened] = (
            client.post(
                "/api/open_tensor",
                json={
                    "path": tree["path"],
                    "key_path": tree["tree"][0]["key_path"],
                    "interpretation": {"kind": "audio", "layout": "[N]", "sr": SR},
                },
            )
            .raise_for_status()
            .json()["lanes"]
        )
        pushed_pcm = _pcm(client, lane)
        np.testing.assert_array_equal(pushed_pcm, [expected])
        np.testing.assert_array_equal(pushed_pcm, _pcm(client, opened))


def test_show_feature_and_ordered_dictionary_with_remote_credentials(server, tmp_path):
    client, env, token, log = server
    remote = env | {"VSR_HOME": str(tmp_path / "missing"), "VSR_URL": str(client.base_url)}
    script = """
        import numpy as np
        import vsr

        vsr.show({"reference": np.zeros(4), "prediction": np.ones(6)}, sr=8000)
        vsr.show(np.zeros((3, 9)), kind="feature", sr=8000, hop=80, name="model mel",
                 freq_axis=dict(type="mel", n_mels=3, fmin=0, fmax=4000, htk=False),
                 value_scale="ln_magnitude")
        vsr.show(np.array([[3+4j, 0+2j]], dtype=np.complex128), kind="feature",
                 sr=8000, hop=80, name="complex feature", freq_axis=dict(type="index"),
                 value_scale="raw")
    """
    unauthenticated = _sender(remote | {"VSR_TOKEN": "incorrect"}, script)
    assert unauthenticated.returncode != 0
    assert "401" in unauthenticated.stderr
    assert _get_lanes(client) == []

    sent = _sender(remote | {"VSR_TOKEN": token}, script)
    assert sent.returncode == 0, sent.stderr
    reference, prediction, feature, complex_feature = _get_lanes(client)
    assert [(lane["name"], lane["samples"]) for lane in (reference, prediction)] == [
        ("reference", 4),
        ("prediction", 6),
    ]
    assert log.read_text().count('"POST /api/push HTTP/1.1" 200') == 4
    assert {key: feature[key] for key in ("name", "kind", "sr", "rows", "frames")} == {
        "name": "model mel",
        "kind": "feature",
        "sr": SR,
        "rows": 3,
        "frames": 9,
    }
    assert feature["frame_rate"] == 100
    assert feature["freq_axis"] == {
        "type": "mel",
        "n_mels": 3,
        "fmin": 0,
        "fmax": 4000,
        "htk": False,
    }
    assert feature["value_scale"] == "ln_magnitude"
    assert complex_feature["value_scale"] == "magnitude"
    response = client.get(
        f"/api/lanes/{complex_feature['id']}/spectrogram",
        params={"t0": 0, "t1": 0.02, "width": 2, "f_lo": 0, "f_hi": 1},
    ).raise_for_status()
    values, _ = decode_frame(response.content)
    np.testing.assert_array_equal(values, (20 * np.log10([[5, 2]])).astype(np.float16))


def test_show_local_runtime_bypasses_http_proxy(server):
    client, env, _, _ = server
    proxy_requests = []

    class Proxy(BaseHTTPRequestHandler):
        def do_POST(self):
            proxy_requests.append(self.command)
            self.send_response_only(502)
            self.end_headers()

    with HTTPServer(("127.0.0.1", 0), Proxy) as proxy:
        thread = Thread(target=proxy.serve_forever)
        thread.start()
        try:
            proxied = env | {"http_proxy": f"http://127.0.0.1:{proxy.server_port}"}
            proxied.pop("NO_PROXY", None)
            proxied.pop("no_proxy", None)
            sent = _sender(
                proxied,
                "import numpy as np, vsr; vsr.show(np.zeros(2), sr=8000, name='loopback')",
            )
        finally:
            proxy.shutdown()
            thread.join()

    assert proxy_requests == [], sent.stderr
    assert sent.returncode == 0, sent.stderr
    [lane] = _get_lanes(client)
    assert lane["name"] == "loopback"
    np.testing.assert_array_equal(_pcm(client, lane), [[0, 0]])


def test_show_infers_and_accepts_audio_layouts(server):
    client, env, _, _ = server
    inputs = """
        import numpy as np
        import torch
        import vsr

        channels = np.arange(18, dtype=np.float32).reshape(2, 9) / 16
        vsr.show(channels, sr=8000, name="channels first")
        vsr.show(channels.T, sr=8000, name="channels last")
        vsr.show(channels, sr=8000, name="batched mono", layout="[B,N]")
        stereo = torch.tensor(channels).requires_grad_()
        vsr.show(stereo.unsqueeze(0).expand(2, -1, -1), sr=8000,
                 name="batched stereo", layout="[B,C,N]")
        vsr.show(np.zeros((9, 9)), sr=8000)
    """
    sent = _sender(env, inputs)
    assert sent.returncode != 0
    assert "ValueError:" in sent.stderr and "layout=" in sent.stderr

    lanes = _get_lanes(client)
    assert [lane["name"] for lane in lanes] == [
        "channels first",
        "channels last",
        "batched mono [0]",
        "batched mono [1]",
        "batched stereo [0]",
        "batched stereo [1]",
    ]
    channels = np.arange(18, dtype=np.float32).reshape(2, 9) / 16
    expected = [channels, channels, channels[:1], channels[1:], channels, channels]
    for lane, samples in zip(lanes, expected, strict=True):
        np.testing.assert_array_equal(_pcm(client, lane), samples)


def test_show_rejects_local_hostname_before_connection(tmp_path):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen()
        (tmp_path / "runtime.json").write_text(
            json.dumps(
                {
                    "hostname": f"{socket.gethostname()}-other",
                    "pid": os.getpid(),
                    "port": listener.getsockname()[1],
                    "token": "test",
                }
            )
        )
        sent = _sender(_env(tmp_path), "import numpy as np, vsr; vsr.show(np.zeros(2), sr=8000)")
        assert sent.returncode != 0
        assert "hostname" in sent.stderr and "VSR_URL" in sent.stderr
        assert select.select([listener], [], [], 0)[0] == []


@pytest.mark.parametrize("stale_runtime", [False, True])
def test_show_without_server_gives_startup_command(tmp_path, stale_runtime):
    with socket.socket() as unused:
        unused.bind(("127.0.0.1", 0))
        if stale_runtime:
            (tmp_path / "runtime.json").write_text(
                json.dumps(
                    {
                        "hostname": socket.gethostname(),
                        "pid": os.getpid(),
                        "port": unused.getsockname()[1],
                        "token": "test",
                    }
                )
            )
        sent = _sender(_env(tmp_path), "import numpy as np, vsr; vsr.show(np.zeros(2), sr=8000)")
        assert sent.returncode != 0
        assert "vsr serve" in sent.stderr


def test_import_vsr_loads_plot_only_on_access(tmp_path):
    sent = _sender(
        _env(tmp_path),
        """
        import sys
        import vsr

        restricted = {"fastapi", "sounddevice", "librosa", "matplotlib"}
        assert not restricted.intersection(sys.modules)
        assert "vsr.plot" not in sys.modules
        assert "vsr.dsp" not in sys.modules
        assert callable(vsr.plot.spectrogram)
        assert "matplotlib" in sys.modules
        assert not (restricted - {"matplotlib"}).intersection(sys.modules)
        """,
    )
    assert sent.returncode == 0, sent.stderr
