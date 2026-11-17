import json
import os
import subprocess
import sys
import time
import urllib.request


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
