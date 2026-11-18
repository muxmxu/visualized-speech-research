"""Persistent per-file dataset result cache."""

import json
import sqlite3
from contextlib import closing
from hashlib import sha256
from pathlib import Path

import numpy as np

SCHEMA = """
CREATE TABLE IF NOT EXISTS dataset_results (
    path TEXT NOT NULL,
    size INTEGER NOT NULL,
    mtime_ns INTEGER NOT NULL,
    metrics_version INTEGER NOT NULL,
    analyzer_id TEXT NOT NULL,
    analyzer_version INTEGER NOT NULL,
    params_hash TEXT NOT NULL,
    cells TEXT NOT NULL,
    ltas BLOB,
    PRIMARY KEY (path, size, mtime_ns, metrics_version, analyzer_id, analyzer_version, params_hash)
)
"""


def params_hash(params: dict) -> str:
    canonical = json.dumps(params, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return sha256(canonical.encode()).hexdigest()


class Store:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.execute(SCHEMA)
            connection.commit()

    def connection(self):
        return closing(sqlite3.connect(self.path))


def read(connection: sqlite3.Connection, key: tuple):
    result = connection.execute(
        """
        SELECT cells, ltas FROM dataset_results
        WHERE path=? AND size=? AND mtime_ns=? AND metrics_version=?
          AND analyzer_id=? AND analyzer_version=? AND params_hash=?
        """,
        key,
    ).fetchone()
    if result is None:
        return None
    cells, ltas = result
    return json.loads(cells), np.frombuffer(ltas, dtype="<f2") if ltas is not None else None


def write(connection: sqlite3.Connection, key: tuple, cells: dict, ltas: np.ndarray | None = None):
    connection.execute(
        "INSERT OR REPLACE INTO dataset_results VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            *key,
            json.dumps(cells, allow_nan=False, separators=(",", ":")),
            ltas.astype("<f2", copy=False).tobytes() if ltas is not None else None,
        ),
    )
    connection.commit()
