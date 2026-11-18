import json
import os
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from importlib.resources import files
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit

import numpy as np
import pytest

from vsr import cli

CAPTURE_BROWSER = (
    "import json, webbrowser; from pathlib import Path; "
    "webbrowser.open = lambda url, new=0: Path('browser.json').write_text(json.dumps([url, new])); "
    "from vsr.cli import main; main()"
)


def test_real_server_runtime(tmp_path):
    env = os.environ | {"VSR_HOME": str(tmp_path)}
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
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        runtime_file = tmp_path / "runtime.json"
        for _ in range(200):
            if runtime_file.exists():
                break
            time.sleep(0.05)
        runtime = json.loads(runtime_file.read_text())
        assert runtime_file.stat().st_mode & 0o777 == 0o600
        for _ in range(200):
            try:
                request = urllib.request.Request(
                    f"http://127.0.0.1:{runtime['port']}/api/ping",
                    headers={"Authorization": f"Bearer {runtime['token']}"},
                )
                with urllib.request.urlopen(request, timeout=1) as response:
                    assert json.load(response)["ok"]
                break
            except OSError:
                time.sleep(0.05)
        else:
            raise AssertionError("server did not start")
    finally:
        process.terminate()
        process.wait(timeout=10)


@pytest.fixture
def real_server(tmp_path, request):
    """Run the real CLI with a new runtime and fixture working directory."""
    (tmp_path / "config.toml").write_text("port = 0\n")
    env = os.environ | {"VSR_HOME": str(tmp_path)}
    args = request.param
    process = subprocess.Popen(
        [sys.executable, "-c", CAPTURE_BROWSER, *args],
        env=env,
        cwd=tmp_path,
        stdout=subprocess.DEVNULL,
    )
    try:
        runtime_file = tmp_path / "runtime.json"
        for _ in range(200):
            if runtime_file.exists():
                try:
                    runtime = json.loads(runtime_file.read_text())
                    assert cli.request(runtime, "ping")["ok"]
                    break
                except (OSError, ValueError):
                    assert process.poll() is None
            time.sleep(0.05)
        else:
            raise AssertionError("server did not start")
        assert runtime_file.stat().st_mode & 0o777 == 0o600
        yield runtime
    finally:
        process.send_signal(signal.SIGINT)
        process.wait(timeout=10)
    assert not runtime_file.exists()


@pytest.mark.parametrize("real_server", [["--device", "cpu", "signal.npy"]], indirect=True)
def test_cold_tensor_ready_for_browser_claim(real_server, tmp_path):
    url, new = json.loads((tmp_path / "browser.json").read_text())
    assert new == 2
    assert not (tmp_path / "signal.npy").exists()
    np.save(tmp_path / "signal.npy", np.ones(10, dtype=np.float32))
    identifier = urlsplit(url).fragment.removeprefix("open=")
    claimed = cli.request(real_server, "open", {"paths": []}, launch=identifier)
    assert claimed["path"] == str(tmp_path / "signal.npy")
    assert claimed["tree"][0]["shape"] == [10]


@pytest.mark.parametrize(
    "real_server", [["serve", "--no-browser", "--device", "cpu"]], indirect=True
)
def test_warm_tensor_cli_uses_direct_loopback(real_server, tmp_path, monkeypatch):
    runtime = real_server
    proxy_requests = []

    class Proxy(BaseHTTPRequestHandler):
        def do_GET(self):
            proxy_requests.append(self.path)
            self.send_error(502)

        do_POST = do_GET

    with ThreadingHTTPServer(("127.0.0.1", 0), Proxy) as proxy:
        thread = Thread(target=proxy.serve_forever)
        thread.start()
        try:
            monkeypatch.delenv("no_proxy", raising=False)
            monkeypatch.delenv("NO_PROXY", raising=False)
            monkeypatch.setenv("http_proxy", f"http://127.0.0.1:{proxy.server_port}")
            subprocess.run(
                [sys.executable, "-c", CAPTURE_BROWSER, "--device", "cuda:999", "signal.npy"],
                env=os.environ | {"VSR_HOME": str(tmp_path)},
                cwd=tmp_path,
                check=True,
                capture_output=True,
                text=True,
                timeout=15,
            )
        finally:
            proxy.shutdown()
            thread.join()
    assert proxy_requests == []
    url, new = json.loads((tmp_path / "browser.json").read_text())
    assert url.startswith(f"http://127.0.0.1:{runtime['port']}/?token={runtime['token']}#open=")
    assert new == 2
    settings = cli.request(runtime, "settings")
    assert settings["compute_device"] == "cpu"
    assert settings["reason"] is not None
    np.save(tmp_path / "signal.npy", np.ones(10, dtype=np.float32))
    identifier = urlsplit(url).fragment.removeprefix("open=")
    assert cli.request(runtime, "open", {"paths": []}, launch=identifier)["path"] == str(
        tmp_path / "signal.npy"
    )


@pytest.mark.parametrize("failure_at", ["app construction", "browser launch"])
def test_cold_start_releases_runtime_and_listener(tmp_path, monkeypatch, failure_at):
    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    runtime_file = tmp_path / "runtime.json"
    ports = []

    def fail(*args, **kwargs):
        ports.append(json.loads(runtime_file.read_text())["port"])
        raise RuntimeError(failure_at)

    if failure_at == "app construction":
        monkeypatch.setattr(cli, "create_app", fail)
    else:
        monkeypatch.setattr(cli.webbrowser, "open", fail)
    with pytest.raises(RuntimeError, match=failure_at):
        cli.serve("127.0.0.1", 0, False, False, "cpu", [])
    assert not runtime_file.exists()
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", ports[0]))


def test_existing_server_opens_paths_and_browser(monkeypatch, tmp_path):
    from vsr import cli

    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    calls = []
    runtime = {"port": 12345, "token": "secret"}
    monkeypatch.setattr(cli, "running", lambda: runtime)
    monkeypatch.setattr(cli, "request", lambda *args: calls.append(args))
    monkeypatch.setattr(cli.webbrowser, "open", lambda url: calls.append(url))
    monkeypatch.setattr(sys, "argv", ["vsr", str(tmp_path / "file.wav")])
    cli.main()
    assert calls[0] == (runtime, "open", {"paths": [str(tmp_path / "file.wav")]})
    assert calls[1] == "http://127.0.0.1:12345/?token=secret"


def test_existing_server_applies_explicit_device(monkeypatch, tmp_path):
    from fastapi.testclient import TestClient

    from vsr import cli
    from vsr.server.app import create_app

    monkeypatch.setenv("VSR_HOME", str(tmp_path))
    runtime = {"port": 12345, "token": "secret"}
    with TestClient(create_app("secret", "cpu")) as client:
        monkeypatch.setattr(cli, "running", lambda: runtime)
        monkeypatch.setattr(
            cli,
            "request",
            lambda runtime, path, data: client.post(
                f"/api/{path}", json=data, headers={"Authorization": "Bearer secret"}
            ).json(),
        )
        monkeypatch.setattr(cli.webbrowser, "open", lambda url: None)
        monkeypatch.setattr(sys, "argv", ["vsr", "--device", "cuda:999"])
        cli.main()
        settings = client.get("/api/settings", headers={"Authorization": "Bearer secret"}).json()
        assert settings["compute_device"] == "cpu"
        assert settings["reason"] is not None


@pytest.mark.parametrize(
    ("flags", "agents"),
    [
        (["--claude"], [".claude"]),
        (["--codex"], [".agents"]),
        (["--claude", "--codex"], [".claude", ".agents"]),
    ],
)
def test_skill_install_links_selected_packaged_destinations(monkeypatch, tmp_path, flags, agents):
    from vsr import cli

    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "vsr"))
    monkeypatch.setattr(sys, "argv", ["vsr", "skill", "install", *flags])
    source = Path(files("vsr").joinpath("skills", "vsr-speech-visualization")).resolve()
    paths = [tmp_path / agent / "skills" / "vsr-speech-visualization" for agent in agents]
    cli.main()
    for path in paths:
        assert path.is_symlink()
        assert path.resolve() == source
        assert (path / "SKILL.md").is_file()
        assert (path / "presets.toml").is_file()

    cli.main()
    assert [path.resolve() for path in paths] == [source] * len(agents)
    assert sorted(path.name for path in tmp_path.iterdir()) == sorted(agents)


@pytest.mark.parametrize("conflict", ["directory", "broken_symlink"])
def test_skill_install_preserves_conflicting_destinations(monkeypatch, tmp_path, capsys, conflict):
    from vsr import cli

    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    monkeypatch.setenv("VSR_HOME", str(tmp_path / "vsr"))
    monkeypatch.setattr(sys, "argv", ["vsr", "skill", "install", "--claude", "--codex"])
    destination = tmp_path / ".agents" / "skills" / "vsr-speech-visualization"
    destination.parent.mkdir(parents=True)
    unrelated = tmp_path / "missing-skill"
    if conflict == "directory":
        destination.mkdir()
        (destination / "SKILL.md").write_text("Existing skill")
    else:
        destination.symlink_to(unrelated)

    with pytest.raises(SystemExit) as failure:
        cli.main()
    assert failure.value.code != 0
    assert str(destination) in capsys.readouterr().err
    assert not (tmp_path / ".claude").exists()
    if conflict == "directory":
        assert (destination / "SKILL.md").read_text() == "Existing skill"
    else:
        assert destination.is_symlink() and destination.readlink() == unrelated
