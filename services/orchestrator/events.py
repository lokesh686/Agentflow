"""
Task 5 — Redis Pub/Sub event streaming.

Every time an agent step completes, we:
  1. Persist the step to MongoDB (Execution.steps[])
  2. Publish a JSON event to the execution's Redis channel
  3. The API gateway subscribes and forwards via Socket.io to the browser

Event shape:
{
  "type": "step" | "status" | "log" | "approval_required" | "done" | "error",
  "execution_id": str,
  "payload": { ... }
}
"""

import json
import asyncio
from datetime import datetime, timezone
from typing import Any, Literal

from .redis_client import get_redis, execution_channel, team_channel
from .db import get_db


EventType = Literal[
    "step",
    "status",
    "log",
    "approval_required",
    "done",
    "error",
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def publish_event(
    execution_id: str,
    team_id: str,
    event_type: EventType,
    payload: dict[str, Any],
) -> None:
    """Publish a JSON event to the execution's Redis pub/sub channel."""
    redis = await get_redis()
    event = {
        "type": event_type,
        "execution_id": execution_id,
        "timestamp": _now(),
        "payload": payload,
    }
    message = json.dumps(event)

    # Publish to both execution-specific and team-level channels
    await asyncio.gather(
        redis.publish(execution_channel(execution_id), message),
        redis.publish(team_channel(team_id), message),
    )


async def publish_step(
    execution_id: str,
    team_id: str,
    step: dict[str, Any],
) -> None:
    """Publish an agent step event and persist it to MongoDB."""
    db = await get_db()

    # Persist step to MongoDB atomically
    await db.executions.update_one(
        {"_id": execution_id},
        {
            "$push": {"steps": step},
            "$inc": {
                "totalTokens.prompt": step.get("tokensUsed", {}).get("prompt", 0),
                "totalTokens.completion": step.get("tokensUsed", {}).get("completion", 0),
                "totalTokens.total": step.get("tokensUsed", {}).get("total", 0),
            },
        },
    )

    # Stream to subscribers
    await publish_event(execution_id, team_id, "step", step)


async def publish_status(
    execution_id: str,
    team_id: str,
    status: str,
    error: str | None = None,
) -> None:
    """Update execution status in MongoDB and broadcast."""
    db = await get_db()
    update: dict[str, Any] = {"status": status}
    if error:
        update["error"] = error
    if status == "RUNNING":
        update["startedAt"] = _now()
    if status in ("COMPLETED", "FAILED", "CANCELLED"):
        update["completedAt"] = _now()

    await db.executions.update_one(
        {"_id": execution_id},
        {"$set": update},
    )

    await publish_event(
        execution_id,
        team_id,
        "status",
        {"status": status, "error": error},
    )


async def publish_approval_request(
    execution_id: str,
    team_id: str,
    agent_name: str,
    context: str,
    options: list[str],
) -> None:
    """Pause execution and request human approval."""
    db = await get_db()
    approval = {
        "required": True,
        "agentName": agent_name,
        "context": context,
        "options": options,
        "requestedAt": _now(),
    }
    await db.executions.update_one(
        {"_id": execution_id},
        {"$set": {"status": "PAUSED", "humanApproval": approval}},
    )
    await publish_event(
        execution_id,
        team_id,
        "approval_required",
        {"agentName": agent_name, "context": context, "options": options},
    )


async def publish_done(
    execution_id: str,
    team_id: str,
    final_output: str,
    estimated_cost_usd: float,
) -> None:
    """Mark execution completed and broadcast final result."""
    db = await get_db()
    await db.executions.update_one(
        {"_id": execution_id},
        {
            "$set": {
                "status": "COMPLETED",
                "finalOutput": final_output,
                "estimatedCostUsd": estimated_cost_usd,
                "completedAt": _now(),
            }
        },
    )
    await publish_event(
        execution_id,
        team_id,
        "done",
        {"finalOutput": final_output, "estimatedCostUsd": estimated_cost_usd},
    )


async def publish_error(
    execution_id: str,
    team_id: str,
    error: str,
) -> None:
    """Mark execution failed and broadcast error."""
    db = await get_db()
    await db.executions.update_one(
        {"_id": execution_id},
        {
            "$set": {
                "status": "FAILED",
                "error": error,
                "completedAt": _now(),
            }
        },
    )
    await publish_event(execution_id, team_id, "error", {"error": error})
