"""Shared dataset manifest, CPU analysis, and column/LTAS results."""

import csv
import json
import logging
import os
from collections.abc import Callable, Sequence
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from dataclasses import dataclass
from decimal import Decimal
from math import floor, isfinite, log2, log10
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Event

import numpy as np
import soundfile as sf
import torch

from vsr.analyzers.registry import Analyzer
from vsr.api import Scalars, _dataset_cpu_scope
from vsr.dataset import store
from vsr.dsp.spectrum import NoEligibleFrames, active_frames, welch
from vsr.io.audio import AUDIO_EXTENSIONS
from vsr.presets import resolve_preset

logger = logging.getLogger(__name__)
METRICS_VERSION = 1
BANDWIDTH_DROP_DB = 50.0
MIN_ACTIVE_SAMPLE = 10 ** (-70 / 20)
LTAS_FREQS = 20 * 2 ** (np.arange(1 + floor(24 * log2(24000 / 20))) / 24)
_METRICS = (
    "duration_s",
    "sr",
    "channels",
    "subtype",
    "peak_dbfs",
    "rms_dbfs",
    "clip_ratio",
    "dc_offset",
    "lead_silence_s",
    "trail_silence_s",
    "active_ratio",
    "bandwidth_hz",
)


@dataclass
class Entry:
    source: Path
    path: Path
    metadata: dict


@dataclass
class SourceFiles:
    paths: list[Path]
    entries: list[Entry]
    headers: list[str]

    @property
    def directories(self):
        return [path for path in self.paths if path.is_dir()]


def manifest_rows(source: Path):
    with source.open(encoding="utf-8-sig", newline="") as document:
        match source.suffix.lower():
            case ".csv" | ".tsv":
                reader = csv.DictReader(
                    document, delimiter="\t" if source.suffix.lower() == ".tsv" else ","
                )
                if reader.fieldnames is None or "path" not in reader.fieldnames:
                    raise ValueError(f"Manifest requires a path column: {source}")
                return list(reader), [name for name in reader.fieldnames if name != "path"]
            case ".jsonl":
                return [json.loads(line) for line in document if line.strip()], []
    raise ValueError(f"Expected a directory or CSV, TSV, or JSONL manifest: {source}")


def enumerate_sources(sources: list[str]) -> SourceFiles:
    paths = [Path(raw).expanduser().resolve(strict=True) for raw in sources]
    entries, headers = [], {}
    for source in paths:
        if source.is_dir():
            files = sorted(
                path
                for path in source.rglob("*")
                if path.suffix.lower() in AUDIO_EXTENSIONS and path.is_file()
            )
            entries.extend(Entry(source, path.resolve(), {}) for path in files)
            continue
        rows, columns = manifest_rows(source)
        headers.update(dict.fromkeys(columns))
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("path"), str) or not row["path"]:
                raise ValueError(f"Manifest row needs a nonempty path: {source}")
            if None in row:
                raise ValueError(f"Manifest row has more fields than its header: {source}")
            audio_path = (source.parent / row["path"]).resolve()
            metadata = {name: value for name, value in row.items() if name != "path"}
            if source.suffix.lower() != ".jsonl":
                metadata = {name: value or None for name, value in metadata.items()}
            headers.update(dict.fromkeys(metadata))
            entries.append(Entry(source, audio_path, metadata))
    return SourceFiles(paths, entries, list(headers))


@dataclass
class ScalarRequest:
    entry: Analyzer
    params: dict
    cache_hash: str

    @classmethod
    def prepare(cls, entry: Analyzer, values: dict):
        params = entry.arguments(values)
        key = store.params_hash({"params": params, "source_revision": entry.source_revision})
        return cls(entry, params, key)


@dataclass
class FileResult:
    metrics: dict
    ltas: np.ndarray | None
    scalars: dict


def read_file(path: Path) -> tuple[np.ndarray, int, str]:
    with sf.SoundFile(path) as audio:
        x = audio.read(dtype="float32", always_2d=True)
        if not x.size or not np.isfinite(x).all():
            raise ValueError("Audio file must contain finite samples")
        return x, audio.samplerate, audio.subtype


def power_db(value):
    result = np.full_like(value, -np.inf)
    np.log10(value, out=result, where=value > 0)
    return 10 * result


def ltas_metrics(mono, sr, active, bandwidth_drop_db):
    preset = resolve_preset("ltas", sr)
    if len(mono) < preset["win_length"] or not active.any():
        return None, None
    try:
        values, bins = welch(
            mono,
            sr,
            unit="db_per_hz",
            active_only=True,
            window=preset["window"],
            n_fft=preset["n_fft"],
            win_length=preset["win_length"],
            hop=preset["hop"],
        )
    except NoEligibleFrames:
        return None, None
    db = values.numpy()[0, 0]
    freqs = bins.numpy().astype(np.float64)
    reference = db[(freqs >= 300) & (freqs <= 3000)]
    bandwidth = None
    if len(reference):
        median = float(np.median(reference))
        if isfinite(median):
            within = freqs[db >= median - bandwidth_drop_db]
            if len(within):
                bandwidth = float(within[-1])

    # Each LTAS point represents the power in its 1/24-octave band.
    power = 10 ** (db.astype(np.float64) / 10)
    ratio = 2 ** (1 / 48)
    left = np.searchsorted(freqs, LTAS_FREQS / ratio)
    right = np.searchsorted(freqs, LTAS_FREQS * ratio)
    averaged = np.interp(LTAS_FREQS, freqs, power)
    for idx, (first, last) in enumerate(zip(left, right, strict=True)):
        if first < last:
            averaged[idx] = power[first:last].mean()
    level = power_db(averaged)
    level[LTAS_FREQS > sr / 2] = np.nan
    return bandwidth, level.astype(np.float16)


def file_metrics(x: np.ndarray, sr: int, subtype: str, bandwidth_drop_db: float):
    mono = x.mean(axis=1)
    amplitude = np.abs(mono)
    peak = float(amplitude.max())
    rms = float(np.sqrt(np.mean(mono.astype(np.float64) ** 2)))
    heard = np.flatnonzero(amplitude > MIN_ACTIVE_SAMPLE)
    _, active = active_frames(mono, sr)
    bandwidth, ltas = ltas_metrics(mono, sr, active.numpy(), bandwidth_drop_db)
    samples = len(mono)
    metrics = {
        "duration_s": samples / sr,
        "sr": sr,
        "channels": x.shape[1],
        "subtype": subtype,
        "peak_dbfs": 20 * log10(peak) if peak else None,
        "rms_dbfs": 20 * log10(rms) if rms else None,
        "clip_ratio": float(np.mean(amplitude >= 0.999)),
        "dc_offset": float(np.mean(mono, dtype=np.float64)),
        "lead_silence_s": (int(heard[0]) if len(heard) else samples) / sr,
        "trail_silence_s": (samples - int(heard[-1]) - 1 if len(heard) else samples) / sr,
        "active_ratio": float(active.numpy().mean()) if active.numel() else None,
        "bandwidth_hz": bandwidth,
    }
    return metrics, ltas


def run_scalar(request: ScalarRequest, audio: np.ndarray, sr: int) -> dict:
    try:
        result = request.entry.function(torch.from_numpy(audio.T.copy()), sr, **request.params)
        if not isinstance(result, Scalars):
            raise ValueError("Selected analyzer did not return Scalars")
        if not all(
            isinstance(key, str) and isfinite(value) for key, value in result.values.items()
        ):
            raise ValueError("Scalar output requires string names and finite values")
        return {f"{request.entry.id}.{key}": float(value) for key, value in result.values.items()}
    except Exception as exc:
        logger.exception("Dataset analyzer %s failed", request.entry.id)
        return {"error": f"{request.entry.id}: {exc}"}


def scan_file(entry, cache, bandwidth_drop_db, builtin_hash, analyzers) -> FileResult:
    try:
        stats = entry.path.stat()
    except OSError as exc:
        return FileResult({"error": str(exc)}, None, {})
    identity = (str(entry.path), stats.st_size, stats.st_mtime_ns, METRICS_VERSION)
    key = (*identity, "", 0, builtin_hash)
    with cache.connection() as connection, _dataset_cpu_scope():
        builtin = store.read(connection, key)
        if builtin is not None and "error" in builtin[0]:
            return FileResult(*builtin, {})

        records = []
        for analyzer in analyzers:
            scalar_key = (*identity, analyzer.entry.id, analyzer.entry.version, analyzer.cache_hash)
            cached = store.read(connection, scalar_key)
            records.append((analyzer, scalar_key, cached))

        if builtin is None or any(cached is None for _, _, cached in records):
            try:
                x, sr, subtype = read_file(entry.path)
            except (OSError, sf.SoundFileError, ValueError) as exc:
                metrics = {"error": str(exc)}
                if builtin is None:
                    store.write(connection, key, metrics)
                else:
                    return FileResult(builtin[0] | metrics, builtin[1], {})
                return FileResult(metrics, None, {})
            if builtin is None:
                builtin = file_metrics(x, sr, subtype, bandwidth_drop_db)
                store.write(connection, key, *builtin)

        metrics, ltas = builtin
        scalars, failures = {}, []
        for analyzer, scalar_key, cached in records:
            if cached is None:
                values = run_scalar(analyzer, x, sr)
                store.write(connection, scalar_key, values)
            else:
                values = cached[0]
            if "error" in values:
                failures.append(values["error"])
            else:
                scalars.update(values)
        if failures:
            metrics = metrics | {"error": "; ".join(failures)}
        return FileResult(metrics, ltas, scalars)


@dataclass
class Dataset:
    columns: list[str]
    data: dict
    ltas: list[np.ndarray | None]

    def rows(self):
        return {"columns": self.columns, "data": self.data}


def dataset_rows(entries, results, headers):
    scalars = list(dict.fromkeys(key for result in results for key in result.scalars))
    builtin = ["source", "path", *_METRICS, "error"]
    generated = set(builtin + scalars)
    occupied = generated | set(headers)
    aliases = {}
    for name in headers:
        alias = name
        if name in generated:
            while alias in occupied:
                alias = f"meta.{alias}"
            occupied.add(alias)
        aliases[name] = alias
    columns = builtin + list(aliases.values()) + scalars
    data = {column: [] for column in columns}
    for entry, result in zip(entries, results, strict=True):
        cells = {
            "source": str(entry.source),
            "path": str(entry.path),
            **result.metrics,
            **result.scalars,
        }
        cells.update({aliases[name]: value for name, value in entry.metadata.items()})
        for column in columns:
            data[column].append(cells.get(column))
    return Dataset(columns, data, [result.ltas for result in results])


def scan(
    files: SourceFiles,
    cache_file: Path,
    *,
    bandwidth_drop_db: float = BANDWIDTH_DROP_DB,
    analyzers: Sequence[ScalarRequest] = (),
    cancel: Event | None = None,
    progress: Callable[[int, int], None] | None = None,
) -> Dataset:
    if any(cache_file.resolve().is_relative_to(directory) for directory in files.directories):
        raise ValueError("The dataset cache must be outside the input dataset directories")
    cache = store.Store(cache_file)
    builtin_hash = store.params_hash({"bandwidth_drop_db": bandwidth_drop_db})
    workers = min(8, os.cpu_count() or 1)
    entries = files.entries
    total, completed = len(entries), 0
    results = [None] * total
    grouped = {}
    for index, entry in enumerate(entries):
        grouped.setdefault(entry.path, []).append(index)
    remaining = iter(grouped.values())
    if progress is not None:
        progress(completed, total)
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending = {}

        def submit():
            if cancel is not None and cancel.is_set():
                return
            indices = next(remaining, None)
            if indices is not None:
                item = entries[indices[0]]
                future = pool.submit(
                    scan_file, item, cache, bandwidth_drop_db, builtin_hash, analyzers
                )
                pending[future] = indices

        for _ in range(workers):
            submit()
        while pending:
            ready, _ = wait(pending, return_when=FIRST_COMPLETED)
            for future in ready:
                indices = pending.pop(future)
                result = future.result()
                for index in indices:
                    results[index] = result
                completed += len(indices)
                if progress is not None:
                    progress(completed, total)
                submit()

    included = [
        (entry, result)
        for entry, result in zip(entries, results, strict=True)
        if result is not None
    ]
    return dataset_rows(
        [entry for entry, _ in included], [result for _, result in included], files.headers
    )


def percentile(sorted_db, value):
    rank = (len(sorted_db) - 1) * value
    index = int(rank)
    low = sorted_db[index]
    if rank == index or np.isneginf(low):
        return low
    return low + (sorted_db[index + 1] - low) * (rank - index)


def aggregate(dataset: Dataset, groups: dict[str, list[int]]) -> dict[str, np.ndarray]:
    shape = (len(groups), len(LTAS_FREQS))
    mean = np.full(shape, np.nan, dtype=np.float32)
    p10, p90 = mean.copy(), mean.copy()
    for group, indices in enumerate(groups.values()):
        vectors = [
            dataset.ltas[index]
            for index in dict.fromkeys(indices)
            if dataset.ltas[index] is not None
        ]
        if not vectors:
            continue
        rows = np.stack(vectors).astype(np.float64)
        for idx, column in enumerate(rows.T):
            known = np.sort(column[~np.isnan(column)])
            if known.size:
                power = np.mean(10 ** (known / 10))
                mean[group, idx] = 10 * log10(power) if power else -np.inf
                p10[group, idx] = percentile(known, 0.1)
                p90[group, idx] = percentile(known, 0.9)
    return {"freqs": LTAS_FREQS.astype(np.float32), "mean": mean, "p10": p10, "p90": p90}


def csv_cell(value):
    if isinstance(value, (list, dict, bool)):
        return json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    if isinstance(value, float):
        if value == 0:
            return "0"
        number = repr(value)
        if 1e-6 <= abs(value) < 1e21:
            return format(Decimal(number), "f").removesuffix(".0")
        mantissa, exponent = number.split("e")
        return f"{mantissa}e{int(exponent):+d}"
    return value


def write_csv(document, dataset: Dataset):
    writer = csv.writer(document, lineterminator="\n")
    writer.writerow(dataset.columns)
    writer.writerows(
        [csv_cell(value) for value in values] for values in zip(*dataset.data.values(), strict=True)
    )


def write_atomic(path: Path, write: Callable, *, binary: bool = False):
    mode, options = ("wb", {}) if binary else ("w", {"encoding": "utf-8", "newline": ""})
    with NamedTemporaryFile(
        mode, dir=path.parent, prefix=f".{path.name}.", delete=False, **options
    ) as handle:
        temporary = Path(handle.name)
        try:
            write(handle)
            handle.close()
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
