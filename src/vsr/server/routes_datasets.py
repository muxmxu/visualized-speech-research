"""Authenticated dataset jobs and completed result readback."""

import asyncio
import logging
import traceback
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from pathlib import Path
from threading import Event
from typing import Annotated
from uuid import uuid4

from fastapi import HTTPException, Response
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, ConfigDict, Field, FiniteFloat, JsonValue

from vsr.analyzers.registry import Registry
from vsr.dataset.scan import (
    BANDWIDTH_DROP_DB,
    Dataset,
    ScalarRequest,
    aggregate,
    enumerate_sources,
    scan,
)
from vsr.frame import encode_frame

logger = logging.getLogger(__name__)


class AnalyzerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    params: dict[str, JsonValue] = Field(default_factory=dict)


class ScanRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sources: list[Annotated[str, Field(min_length=1)]] = Field(min_length=1)
    bandwidth_drop_db: FiniteFloat = Field(BANDWIDTH_DROP_DB, ge=0)
    analyzers: list[AnalyzerRequest] = Field(default_factory=list)


class GroupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    groups: dict[str, list[Annotated[int, Field(strict=True, ge=0)]]]


@dataclass
class Job:
    id: str
    cancel: Event = field(default_factory=Event)
    dataset: Dataset | None = None
    completed: int = 0
    total: int = 0


class DatasetJobs:
    def __init__(self, connections, cache_file: Path):
        self.connections = connections
        self.cache_file = cache_file
        self.jobs: dict[str, Job] = {}
        self.running: dict[str, asyncio.Task] = {}

    @asynccontextmanager
    async def lifespan(self):
        try:
            yield
        finally:
            for identifier in self.running:
                self.jobs[identifier].cancel.set()
            await asyncio.gather(*self.running.values())

    def get(self, identifier: str) -> Job:
        job = self.jobs.get(identifier)
        if job is None:
            raise HTTPException(404, "Dataset job not found")
        return job

    def finished(self, identifier: str) -> Dataset:
        dataset = self.get(identifier).dataset
        if dataset is None:
            raise HTTPException(409, "Dataset rows are unavailable")
        return dataset

    async def notify(self, job: Job, status: str, error: dict | None = None):
        await self.connections.broadcast(
            {
                "type": "job_progress",
                "id": job.id,
                "status": status,
                "completed": job.completed,
                "total": job.total,
                "error": error,
            }
        )

    def start(self, body: ScanRequest, analyzers: list[ScalarRequest]) -> Job:
        job = Job(uuid4().hex)
        self.jobs[job.id] = job
        self.running[job.id] = asyncio.create_task(self.run(job, body, analyzers))
        return job

    async def run(self, job: Job, body: ScanRequest, analyzers: list[ScalarRequest]):
        loop = asyncio.get_running_loop()

        async def progress(completed: int, total: int):
            job.completed, job.total = completed, total
            await self.notify(job, "running")

        def execute():
            return scan(
                enumerate_sources(body.sources),
                self.cache_file,
                bandwidth_drop_db=body.bandwidth_drop_db,
                analyzers=analyzers,
                cancel=job.cancel,
                progress=lambda completed, total: asyncio.run_coroutine_threadsafe(
                    progress(completed, total), loop
                ).result(),
            )

        try:
            try:
                job.dataset = await run_in_threadpool(execute)
            except Exception as exc:
                logger.exception("Dataset scan %s failed", job.id)
                await self.notify(
                    job,
                    "failed",
                    {
                        "error": type(exc).__name__,
                        "detail": str(exc),
                        "traceback": "".join(traceback.format_exception(exc)),
                    },
                )
            else:
                status = (
                    "cancelled" if job.cancel.is_set() and job.completed < job.total else "done"
                )
                await self.notify(job, status)
        finally:
            self.running.pop(job.id)


def register_datasets(app, registry: Registry, session, connections, cache_file: Path):
    datasets = DatasetJobs(connections, cache_file)

    def refresh_plugins():
        # A dataset can be the first consumer to discover an edited analyzer module.
        with registry.lock:
            changed, affected = registry.refresh()
            with session.lock:
                stale = [
                    lane
                    for lane in session.lanes
                    if lane.parent is not None and lane.source.removeprefix("analyzer:") in affected
                ]
                for lane in stale:
                    lane.stale = True
                    session.mark_derived_stale(lane.id)
        return changed, bool(stale)

    def selected_analyzers(requests: list[AnalyzerRequest]):
        requests_by_id = {request.id: request for request in requests}
        if len(requests_by_id) != len(requests):
            raise HTTPException(422, "Select each Scalar analyzer at most once")
        prepared = []
        with registry.lock:
            for identifier, request in requests_by_id.items():
                entry = registry.analyzers.get(identifier)
                if entry is None or entry.input != "audio" or entry.output == "other":
                    raise HTTPException(422, f"Not an audio Scalar analyzer: {identifier}")
                try:
                    prepared.append(ScalarRequest.prepare(entry, request.params))
                except ValueError as exc:
                    raise HTTPException(422, str(exc)) from exc
        return prepared

    @app.post("/api/datasets")
    async def start(body: ScanRequest):
        selected = []
        if body.analyzers:
            changed, stale = await run_in_threadpool(refresh_plugins)
            if changed:
                await connections.broadcast({"type": "plugins_changed"})
            if stale:
                await connections.broadcast()
            selected = await run_in_threadpool(selected_analyzers, body.analyzers)
        return {"id": datasets.start(body, selected).id}

    @app.get("/api/datasets/{identifier}/rows")
    def rows(identifier: str):
        return datasets.finished(identifier).rows()

    @app.post("/api/datasets/{identifier}/ltas")
    def ltas(identifier: str, body: GroupRequest):
        dataset = datasets.finished(identifier)
        if any(index >= len(dataset.ltas) for group in body.groups.values() for index in group):
            raise HTTPException(422, "LTAS group indices must identify rows in this dataset")
        frame = encode_frame(
            aggregate(dataset, body.groups), {"groups": list(body.groups), "unit": "db_per_hz"}
        )
        return Response(
            frame, media_type="application/octet-stream", headers={"Cache-Control": "no-store"}
        )

    @app.post("/api/datasets/{identifier}/cancel")
    async def cancel(identifier: str):
        datasets.get(identifier).cancel.set()
        return {"id": identifier}

    return datasets
