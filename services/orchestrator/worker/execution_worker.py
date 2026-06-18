"""
BullMQ-backed execution worker.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from ..config import get_settings
from ..db import get_db
from ..events import publish_done, publish_error, publish_status
from ..agents.graph_builder import run_workflow

logger = logging.getLogger("orchestrator.execution_worker")

QUEUE_NAME = "workflow-executions"

settings = get_settings()
REDIS_URL = settings.redis_url

try:
    from bullmq import Queue, Worker  # type: ignore
except Exception:  # pragma: no cover
    Queue = None
    Worker = None

_queue = Queue(QUEUE_NAME, {"connection": REDIS_URL}) if Queue else None
_worker = None


async def process(job: Any, _token: Any = None) -> None:
    db = await get_db()
    execution_id = job.data["executionId"]
    team_id = job.data["teamId"]

    existing = await db.executions.find_one(
        {"_id": execution_id, "status": {"$ne": "QUEUED"}}
    )
    if existing:
        logger.info("Skipping duplicate execution %s", execution_id)
        return

    task_input = job.data.get("input", {})
    if isinstance(task_input, dict):
        task_str = task_input.get("task") or task_input.get("prompt") or json.dumps(task_input)
    else:
        task_str = str(task_input)

    try:
        await publish_status(execution_id, team_id, "RUNNING")

        final_output = await asyncio.wait_for(
            run_workflow(
                job.data["graph"],
                task_str,
                execution_id,
                team_id,
                job.data.get("workflowId", ""),
            ),
            timeout=settings.max_execution_time_seconds,
        )

        exec_doc = await db.executions.find_one({"_id": execution_id})
        total_tokens = exec_doc.get("totalTokens", {}).get("total", 0) if exec_doc else 0
        estimated_cost = total_tokens * 0.000005

        await publish_done(execution_id, team_id, final_output, estimated_cost)

        await db.workflows.update_one(
            {"_id": job.data.get("workflowId")},
            {
                "$inc": {"stats.totalExecutions": 1},
                "$set": {"stats.lastExecutedAt": datetime.now(timezone.utc).isoformat()},
            },
        )
    except asyncio.TimeoutError:
        await publish_error(
            execution_id,
            team_id,
            f"Execution timed out after {settings.max_execution_time_seconds}s",
        )
    except Exception as exc:
        await publish_error(execution_id, team_id, str(exc))


async def start_worker() -> Any:
    global _worker
    if _worker is None:
        if Worker is None:
            raise RuntimeError("bullmq package is not available")
        _worker = Worker(QUEUE_NAME, process, {"connection": REDIS_URL})
        on = getattr(_worker, "on", None)
        if on:
            on("failed", _on_worker_failed)
    return _worker


async def stop_worker() -> None:
    global _worker
    if _worker is None:
        return
    close = getattr(_worker, "close", None)
    if close is not None:
        result = close()
        if asyncio.iscoroutine(result):
            await result
    _worker = None


async def get_queue_metrics() -> dict[str, int]:
    if _queue is None:
        return {"queue_depth": 0, "oldest_job_age_ms": 0}

    queue_depth = 0
    oldest_job_age_ms = 0

    waiting_count = getattr(_queue, "getWaitingCount", None)
    if waiting_count:
        queue_depth = int(await waiting_count())

    get_jobs = getattr(_queue, "getJobs", None)
    if get_jobs and queue_depth > 0:
        jobs = await get_jobs(["waiting"], 0, 0, True)
        if jobs:
            ts = getattr(jobs[0], "timestamp", None)
            if ts:
                oldest_job_age_ms = max(
                    0,
                    int(
                        (
                            datetime.now(timezone.utc).timestamp() * 1000
                        )
                        - int(ts)
                    ),
                )

    return {"queue_depth": queue_depth, "oldest_job_age_ms": oldest_job_age_ms}


async def send_to_dead_letter(job_data: dict[str, Any], reason: str) -> None:
    if _queue is None:
        return

    try:
        dead_letter = Queue(f"{QUEUE_NAME}:failed", {"connection": REDIS_URL})
        await dead_letter.add("failed-execute", {**job_data, "reason": reason})
        close = getattr(dead_letter, "close", None)
        if close:
            result = close()
            if asyncio.iscoroutine(result):
                await result
    except Exception as exc:  # pragma: no cover
        logger.error("Failed to write dead-letter job: %s", exc)
        execution_id = job_data.get("executionId", "")
        team_id = job_data.get("teamId", "")
        if execution_id and team_id:
            await publish_error(execution_id, team_id, f"Dead-letter write failed: {exc}")


def _attempt_counts(job: Any) -> tuple[int, int]:
    attempts_made = int(getattr(job, "attemptsMade", 0) or 0)
    opts = getattr(job, "opts", None) or {}
    max_attempts = int(opts.get("attempts", 3) or 3)
    return attempts_made, max_attempts


async def _notify_api_gateway_dlq(job_data: dict[str, Any], reason: str, attempts: int) -> None:
    url = f"{settings.api_gateway_url.rstrip('/')}/v1/executions/internal/dlq-alert"
    headers = {}
    if settings.internal_api_token:
        headers["x-internal-token"] = settings.internal_api_token

    payload = {
        "executionId": job_data.get("executionId"),
        "reason": reason,
        "attempts": attempts,
        "workflowId": job_data.get("workflowId"),
        "teamId": job_data.get("teamId"),
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        await client.post(url, json=payload, headers=headers)


async def _on_job_failed(job: Any, err: Any) -> None:
    attempts_made, max_attempts = _attempt_counts(job)
    if attempts_made < max_attempts:
        return

    reason = str(err) if err else "Job failed"
    job_data = dict(getattr(job, "data", {}) or {})
    await send_to_dead_letter(job_data, reason)
    await _notify_api_gateway_dlq(job_data, reason, attempts_made)


def _on_worker_failed(job: Any, err: Any) -> None:
    asyncio.create_task(_on_job_failed(job, err))
