"""Internal API routes for the orchestrator service."""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db import get_db
from redis_client import get_redis, EXECUTION_QUEUE

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
    redis = await get_redis()
    job = {
        "executionId": body.execution_id,
        "workflowId": body.workflow_id,
        "teamId": body.team_id,
        "graph": body.graph,
        "input": body.input,
    }
    await redis.lPush(EXECUTION_QUEUE, json.dumps(job))
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
    redis = await get_redis()
    length = await redis.lLen(EXECUTION_QUEUE)
    return {"queue": EXECUTION_QUEUE, "length": length}
