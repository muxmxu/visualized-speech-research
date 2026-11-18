"""Per-application analyzer registrations, source refresh and results."""

import logging
import math
import sys
from collections.abc import Callable
from dataclasses import asdict, dataclass
from importlib.util import module_from_spec, spec_from_file_location
from inspect import getmembers, isfunction, signature
from pathlib import Path
from threading import RLock
from types import ModuleType
from uuid import uuid4

from vsr.analyzers import builtin
from vsr.api import Param

logger = logging.getLogger(__name__)
_TYPES = {float: "float", int: "int", bool: "bool", str: "str"}


@dataclass
class Analyzer:
    id: str
    label: str
    version: int
    input: str
    function: Callable
    params: dict[str, Param]

    def metadata(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "version": self.version,
            "input": self.input,
            "params": {
                name: asdict(param) | {"type": _TYPES[type(param.default)]}
                for name, param in self.params.items()
            },
        }

    def arguments(self, provided: dict) -> dict:
        if unknown := provided.keys() - self.params.keys():
            raise ValueError(f"Unknown analyzer parameters: {', '.join(sorted(unknown))}")
        normalized = {}
        for name, param in self.params.items():
            value = provided.get(name, param.default)
            expected = type(param.default)
            if expected is float and type(value) is int:
                value = float(value)
            if type(value) is not expected or (expected is float and not math.isfinite(value)):
                raise ValueError(f"Parameter {name} must be {_TYPES[expected]}")
            if param.choices is not None and value not in param.choices:
                raise ValueError(f"Parameter {name} must be one of the available choices")
            if (param.min is not None and value < param.min) or (
                param.max is not None and value > param.max
            ):
                raise ValueError(f"Parameter {name} is outside its allowed range")
            normalized[name] = value
        return normalized


def declarations(module: ModuleType) -> dict[str, Analyzer]:
    entries = {}
    for _, function in getmembers(module, isfunction):
        info = getattr(function, "__vsr_analyzer__", None)
        if info is None or function.__module__ != module.__name__:
            continue
        params = {
            name: parameter.default
            for name, parameter in signature(function).parameters.items()
            if isinstance(parameter.default, Param)
        }
        for name, param in params.items():
            if type(param.default) not in _TYPES:
                raise ValueError(f"Parameter {name} needs a float, int, bool or str default")
        entry = Analyzer(**info, function=function, params=params)
        entry.arguments({})
        if entry.id in entries:
            raise ValueError(f"Duplicate analyzer id: {entry.id}")
        entries[entry.id] = entry
    return entries


@dataclass
class Plugin:
    mtime_ns: int
    analyzers: dict[str, Analyzer]
    error: str | None = None


def load_plugin(path: Path, mtime_ns: int) -> Plugin:
    name = f"_vsr_analyzer_{uuid4().hex}"
    module = module_from_spec(spec_from_file_location(name, path))
    sys.modules[name] = module
    try:
        # Compile current bytes, including same-size rewrites within the timestamp of a pyc.
        exec(compile(path.read_bytes(), str(path), "exec"), module.__dict__)
        return Plugin(mtime_ns, declarations(module))
    except Exception as exc:
        logger.exception("Could not load analyzer plugin %s", path)
        return Plugin(mtime_ns, {}, f"{type(exc).__name__}: {exc}")
    finally:
        del sys.modules[name]


class Registry:
    def __init__(self, directories: list[str]) -> None:
        self.directories = [Path(directory).expanduser().resolve() for directory in directories]
        self.builtins = declarations(builtin)
        self.modules: dict[Path, Plugin] = {}
        self.analyzers = self.builtins.copy()
        self.errors: list[dict] = []
        self.results: dict[tuple, object] = {}
        self.lock = RLock()

    def refresh(self) -> tuple[bool, set[str]]:
        with self.lock:
            paths = dict.fromkeys(
                path for directory in self.directories for path in directory.glob("*.py")
            )
            modules = {}
            for path in paths:
                try:
                    mtime_ns = path.stat().st_mtime_ns
                except FileNotFoundError:
                    # Removal during the directory scan follows the same refresh path.
                    mtime_ns = None
                if mtime_ns is None:
                    continue
                plugin = self.modules.get(path)
                modules[path] = (
                    plugin
                    if plugin is not None and plugin.mtime_ns == mtime_ns
                    else load_plugin(path, mtime_ns)
                )
            if modules == self.modules:
                return False, set()

            analyzers, errors = self.builtins.copy(), []
            for path, plugin in sorted(modules.items()):
                if plugin.error is not None:
                    errors.append({"file": str(path), "error": plugin.error})
                for identifier, entry in plugin.analyzers.items():
                    if identifier in analyzers:
                        errors.append(
                            {"file": str(path), "error": f"Duplicate analyzer id: {identifier}"}
                        )
                    else:
                        analyzers[identifier] = entry
            changed = {
                identifier
                for identifier in analyzers.keys() | self.analyzers.keys()
                if analyzers.get(identifier) is not self.analyzers.get(identifier)
            }
            self.results = {
                key: result for key, result in self.results.items() if key[2] not in changed
            }
            self.modules, self.analyzers, self.errors = modules, analyzers, errors
            return True, changed

    def metadata(self) -> dict:
        with self.lock:
            return {
                "analyzers": [entry.metadata() for entry in self.analyzers.values()],
                "errors": self.errors,
            }

    def clear_results(self) -> None:
        with self.lock:
            self.results.clear()
