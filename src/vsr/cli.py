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
from functools import partial
from importlib.resources import files
from pathlib import Path

import uvicorn

from vsr.config import home, load_config
from vsr.io.tensors import TENSOR_EXTENSIONS
from vsr.server.app import OPEN_LAUNCH_HEADER, create_app


def request(runtime: dict, path: str, data: dict | None = None, *, launch: str | None = None):
    body = json.dumps(data).encode() if data is not None else None
    headers = {"Authorization": f"Bearer {runtime['token']}", "Content-Type": "application/json"}
    if launch is not None:
        headers[OPEN_LAUNCH_HEADER] = launch
    req = urllib.request.Request(
        f"http://127.0.0.1:{runtime['port']}/api/{path}", data=body, headers=headers
    )
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(req, timeout=2) as response:
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


def open_browser(url: str, launch_id: str | None) -> None:
    if launch_id is None:
        webbrowser.open(url)
    else:
        webbrowser.open(f"{url}#open={launch_id}", new=2)


def serve(
    host: str,
    port: int,
    no_browser: bool,
    dev: bool,
    device: str,
    paths: list[str],
    *,
    launch_id: str | None = None,
) -> None:
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
    try:
        app = create_app(token, device, paths, launch_id=launch_id)
        if dev or no_browser:
            print(url, flush=True)
        else:
            open_browser(url, launch_id)
        uvicorn.run(app, host=host, port=actual_port, fd=listener.fileno())
    finally:
        listener.close()
        runtime_path.unlink(missing_ok=True)


def _install_skill(args: list[str]) -> None:
    parser = argparse.ArgumentParser(prog="vsr skill install")
    parser.add_argument("--claude", action="store_true")
    parser.add_argument("--codex", action="store_true")
    selected = parser.parse_args(args)
    if not (selected.claude or selected.codex):
        parser.error("specify --claude, --codex, or both")
    name = "vsr-speech-visualization"
    source = Path(files("vsr").joinpath("skills", name)).resolve()
    home_dir = Path.home()
    destinations = [
        home_dir / directory / "skills" / name
        for enabled, directory in ((selected.claude, ".claude"), (selected.codex, ".agents"))
        if enabled
    ]
    pending = []
    for destination in destinations:
        if destination.is_symlink() and destination.resolve() == source:
            continue
        if destination.is_symlink() or destination.exists():
            parser.error(f"skill destination already exists: {destination}")
        pending.append(destination)
    for destination in pending:
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.symlink_to(source, target_is_directory=True)


def _scan(args: list[str]) -> None:
    import numpy as np

    from vsr.dataset.scan import (
        aggregate,
        csv_cell,
        enumerate_sources,
        scan,
        write_atomic,
        write_csv,
    )

    parser = argparse.ArgumentParser(prog="vsr scan")
    parser.add_argument("sources", metavar="SOURCE", nargs="+")
    parser.add_argument("-o", metavar="metrics.csv", required=True, type=Path)
    parser.add_argument("--ltas", metavar="ltas.npz", type=Path)
    parser.add_argument("--group-by", metavar="COL", default="source")
    options = parser.parse_args(args)

    try:
        files = enumerate_sources(options.sources)
        cache_file = home() / "cache" / "datasets.sqlite"
        paths = {
            options.o.expanduser().resolve(),
            *([options.ltas.expanduser().resolve()] if options.ltas is not None else []),
        }
        if options.ltas is not None and len(paths) != 2:
            raise ValueError("CSV and LTAS output paths must differ")
        source_files = {entry.path for entry in files.entries} | set(files.paths)
        for path in paths:
            if (
                path == cache_file.resolve()
                or path in source_files
                or any(path.is_relative_to(directory) for directory in files.directories)
            ):
                raise ValueError(f"Output would write to a dataset source or its cache: {path}")

        dataset = scan(files, cache_file)
        if options.ltas is not None:
            if options.group_by not in dataset.data:
                raise ValueError(f"Unknown group column: {options.group_by}")
            groups = {}
            for index, cell in enumerate(dataset.data[options.group_by]):
                label = "(missing)" if cell is None else str(csv_cell(cell))
                groups.setdefault(label, []).append(index)
            payload = aggregate(dataset, groups)
            payload["groups"] = np.asarray(list(groups), dtype=np.str_)
            write_atomic(
                options.ltas.expanduser().resolve(), partial(np.savez, **payload), binary=True
            )
        write_atomic(
            options.o.expanduser().resolve(), lambda document: write_csv(document, dataset)
        )
    except (OSError, ValueError) as exc:
        parser.error(str(exc))


def main() -> None:
    if sys.argv[1:2] == ["scan"]:
        _scan(sys.argv[2:])
        return
    if sys.argv[1:3] == ["skill", "install"]:
        _install_skill(sys.argv[3:])
        return
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
    args = parser.parse_intermixed_args()
    device = args.device or config["compute_device"]
    paths = [Path(raw).expanduser().resolve() for raw in args.paths]
    has_tensor = any(path.suffix.lower() in TENSOR_EXTENSIONS for path in paths)
    resolved = [str(path) for path in paths]
    runtime = running()
    if runtime:
        if args.device is not None:
            request(runtime, "settings", {"compute_device": args.device})
        launch_id = None
        if has_tensor:
            launch_id = request(runtime, "open", {"paths": resolved}, launch="stage")["launch_id"]
        elif paths:
            request(runtime, "open", {"paths": resolved})
        open_browser(f"http://127.0.0.1:{runtime['port']}/?token={runtime['token']}", launch_id)
    else:
        launch_id = secrets.token_urlsafe(32) if has_tensor else None
        serve("127.0.0.1", config["port"], False, False, device, resolved, launch_id=launch_id)


if __name__ == "__main__":
    main()
