"""Local server command line."""

import argparse
import json
import os
import secrets
import socket
import sys
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

import uvicorn

from vsr.config import home, load_config
from vsr.server.app import create_app


def request(runtime: dict, path: str, data: dict | None = None):
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(
        f"http://127.0.0.1:{runtime['port']}/api/{path}",
        data=body,
        headers={"Authorization": f"Bearer {runtime['token']}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=2) as response:
        return json.load(response)


def running() -> dict | None:
    path = home() / "runtime.json"
    if not path.exists():
        return None
    try:
        runtime = json.loads(path.read_text())
        if runtime["hostname"] != socket.gethostname():
            return None
        os.kill(runtime["pid"], 0)
        request(runtime, "ping")
        return runtime
    except (OSError, ValueError, KeyError, urllib.error.URLError):
        return None


def serve(host: str, port: int, no_browser: bool, dev: bool, device: str, paths: list[str]) -> None:
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    for candidate in range(port, port + 11):
        try:
            listener.bind((host, candidate))
            break
        except OSError:
            if candidate == port + 10:
                listener.close()
                raise
    listener.listen(128)
    actual_port = listener.getsockname()[1]
    token = secrets.token_urlsafe(32)
    runtime = {
        "port": actual_port,
        "pid": os.getpid(),
        "hostname": socket.gethostname(),
        "token": token,
    }
    root = home()
    root.mkdir(parents=True, exist_ok=True)
    runtime_path = root / "runtime.json"
    fd = os.open(runtime_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, "w") as file:
        json.dump(runtime, file)
    if host == "0.0.0.0":
        print("Warning: server is accessible on all interfaces", flush=True)
    url = f"http://127.0.0.1:{5173 if dev else actual_port}/?token={token}"
    if dev:
        print(url, flush=True)
    elif not no_browser:
        webbrowser.open(url)
    try:
        app = create_app(token, device, paths)
        uvicorn.run(app, host=host, port=actual_port, fd=listener.fileno())
    finally:
        listener.close()
        runtime_path.unlink(missing_ok=True)


def main() -> None:
    parser = argparse.ArgumentParser(prog="vsr")
    config = load_config()
    if len(sys.argv) > 1 and sys.argv[1] == "serve":
        parser.add_argument("serve")
        parser.add_argument("--host", default="127.0.0.1")
        parser.add_argument("--port", type=int, default=None)
        parser.add_argument("--no-browser", action="store_true")
        parser.add_argument("--dev", action="store_true")
        parser.add_argument("--device", default=None)
        args = parser.parse_args()
        serve(
            args.host,
            args.port if args.port is not None else config["port"],
            args.no_browser,
            args.dev,
            args.device or config["compute_device"],
            [],
        )
        return
    parser.add_argument("--device", default=None)
    parser.add_argument("paths", nargs="*")
    args = parser.parse_args()
    device = args.device or config["compute_device"]
    runtime = running()
    if runtime:
        if args.device is not None:
            request(runtime, "settings", {"compute_device": args.device})
        if args.paths:
            request(runtime, "open", {"paths": [str(Path(p).resolve()) for p in args.paths]})
        webbrowser.open(f"http://127.0.0.1:{runtime['port']}/?token={runtime['token']}")
    else:
        serve("127.0.0.1", config["port"], False, False, device, args.paths)


if __name__ == "__main__":
    main()
