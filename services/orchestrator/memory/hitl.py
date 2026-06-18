"""
Task 11 — Human-in-the-loop approval manager.

When an agent requires human approval:
  1. Execution is paused via publish_approval_request (persists to DB + broadcasts)
  2. We subscribe to execution:<id>:control channel waiting for a decision
  3. On 'approved' → return True (caller resumes)
  4. On 'rejected' → return False (caller cancels)
  5. On timeout (default 30 min) → return False
"""

import asyncio
import json
import logging

from redis_client import get_redis

logger = logging.getLogger("orchestrator.hitl")

APPROVAL_TIMEOUT_SECONDS = 30 * 60  # 30 minutes


async def request_approval(
    execution_id: str,
    team_id: str,
    agent_name: str,
    context: str,
    options: list[str],
) -> bool:
    """
    Pause and request human approval. Returns True if approved, False if rejected/timeout.
    """
    from events import publish_approval_request

    # Broadcast the approval request
    await publish_approval_request(
        execution_id=execution_id,
        team_id=team_id,
        agent_name=agent_name,
        context=context,
        options=options,
    )

    logger.info(f"Execution {execution_id} paused — awaiting human approval for {agent_name}")

    # Wait for a control message on the execution's control channel
    redis = await get_redis()
    control_channel = f"execution:{execution_id}:control"

    # Use a temporary subscriber for this wait
    pubsub = redis.pubsub()
    await pubsub.subscribe(control_channel)

    try:
        deadline = asyncio.get_event_loop().time() + APPROVAL_TIMEOUT_SECONDS

        async for message in pubsub.listen():
            if asyncio.get_event_loop().time() > deadline:
                logger.warning(f"Execution {execution_id} approval timed out")
                return False

            if message["type"] != "message":
                continue

            try:
                data = json.loads(message["data"])
                command = data.get("command")

                if command == "approved":
                    logger.info(f"Execution {execution_id} approved")
                    return True
                elif command in ("rejected", "cancel"):
                    logger.info(f"Execution {execution_id} rejected/cancelled")
                    return False
            except json.JSONDecodeError:
                continue

        return False  # channel closed

    except asyncio.CancelledError:
        return False
    finally:
        await pubsub.unsubscribe(control_channel)
        await pubsub.aclose()


async def check_cancelled(execution_id: str) -> bool:
    """Check if a cancellation has been requested for this execution."""
    from db import get_db
    db = await get_db()
    doc = await db.executions.find_one({"_id": execution_id}, {"status": 1})
    return doc.get("status") == "CANCELLED" if doc else False
