"""
Task 4+5 — Execution worker.

Continuously polls the Redis queue for new execution jobs.
For each job:
  1. Updates status → RUNNING (broadcasts via pub/sub)
  2. Runs the LangGraph workflow
  3. Updates status → COMPLETED or FAILED
  4. Publishes final result event

This runs as a background asyncio task inside the FastAPI process.
"""

import json
import asyncio
import logging
from datetime import datetime, timezone

from redis_client import get_redis, EXECUTION_QUEUE
from db import get_db
from events import publish_status, publish_done, publish_error
from agents.graph_builder import run_workflow
from config import get_settings

logger = logging.getLogger("orchestrator.worker")


async def process_job(job: dict) -> None:
    """Process a single execution job from the queue."""
    execution_id = job["executionId"]
    team_id = job["teamId"]
    graph = job["graph"]
    task_input = job.get("input", {})

    # Flatten task input to string
    if isinstance(task_input, dict):
        task_str = task_input.get("task") or task_input.get("prompt") or json.dumps(task_input)
    else:
        task_str = str(task_input)

    logger.info(f"Starting execution {execution_id}")

    try:
        # Transition → RUNNING
        await publish_status(execution_id, team_id, "RUNNING")

        # Run the LangGraph workflow (Task 4)
        settings = get_settings()
        final_output = await asyncio.wait_for(
            run_workflow(graph, task_str, execution_id, team_id, job.get("workflowId", "")),
            timeout=settings.max_execution_time_seconds,
        )

        # Estimate cost from accumulated token counts
        db = await get_db()
        exec_doc = await db.executions.find_one({"_id": execution_id})
        total_tokens = exec_doc.get("totalTokens", {}).get("total", 0) if exec_doc else 0
        estimated_cost = total_tokens * 0.000005  # rough gpt-4o pricing

        # Transition → COMPLETED (Task 5 broadcasts)
        await publish_done(execution_id, team_id, final_output, estimated_cost)

        # Update workflow stats
        await db.workflows.update_one(
            {"_id": job.get("workflowId")},
            {
                "$inc": {"stats.totalExecutions": 1},
                "$set": {"stats.lastExecutedAt": datetime.now(timezone.utc).isoformat()},
            },
        )

        logger.info(f"Execution {execution_id} completed")

    except asyncio.TimeoutError:
        msg = f"Execution timed out after {settings.max_execution_time_seconds}s"
        logger.warning(f"Execution {execution_id} timed out")
        await publish_error(execution_id, team_id, msg)

    except Exception as exc:
        logger.error(f"Execution {execution_id} failed: {exc}", exc_info=True)
        await publish_error(execution_id, team_id, str(exc))


async def worker_loop() -> None:
    """Blocking worker loop — polls Redis queue with BRPOP (2s timeout)."""
    logger.info("Execution worker started, polling queue...")

    while True:
        try:
            redis = await get_redis()

            # BRPOP blocks until a message arrives or timeout
            result = await redis.brpop(EXECUTION_QUEUE, timeout=2)

            if result is None:
                continue  # timeout, loop again

            _, raw = result
            job = json.loads(raw)
            asyncio.create_task(process_job(job))

        except asyncio.CancelledError:
            logger.info("Worker loop cancelled, shutting down")
            break
        except Exception as exc:
            logger.error(f"Worker loop error: {exc}", exc_info=True)
            await asyncio.sleep(1)  # back off briefly before retrying
