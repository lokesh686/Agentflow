"""Internal API routes for the orchestrator service."""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_db
from ..worker.execution_worker import QUEUE_NAME, REDIS_URL, get_queue_metrics

try:
    from bullmq import Queue  # type: ignore
except Exception:  # pragma: no cover
    Queue = None

router = APIRouter(tags=["orchestrator"])


class TriggerRequest(BaseModel):
    execution_id: str
    workflow_id: str
    team_id: str
    graph: dict
    input: dict | str = ""


@router.post("/trigger")
async def trigger_execution(body: TriggerRequest):
    """
    Directly enqueue an execution job (called by API gateway or tests).
    The queue worker picks this up and runs the LangGraph workflow.
    """
    if Queue is None:
        raise HTTPException(status_code=503, detail="Queue unavailable")

    queue = Queue(QUEUE_NAME, {"connection": REDIS_URL})
    job = {
        "executionId": body.execution_id,
        "workflowId": body.workflow_id,
        "teamId": body.team_id,
        "graph": body.graph,
        "input": body.input,
    }
    await queue.add(
        "execute",
        job,
        {"jobId": body.execution_id, "removeOnComplete": 100, "removeOnFail": 500},
    )
    return {"queued": True, "executionId": body.execution_id}


@router.get("/executions/{execution_id}/status")
async def get_execution_status(execution_id: str):
    """Fetch current execution status from MongoDB."""
    db = await get_db()
    doc = await db.executions.find_one(
        {"_id": execution_id},
        {"status": 1, "totalTokens": 1, "estimatedCostUsd": 1, "completedAt": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Execution not found")
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("/queue/length")
async def queue_length():
    """Return current execution queue depth."""
    metrics = await get_queue_metrics()
    return {"queue": QUEUE_NAME, "length": metrics["queue_depth"]}
