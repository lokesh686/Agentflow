import unittest
from unittest.mock import AsyncMock, patch

from worker import execution_worker


class Job:
    def __init__(self, data):
        self.data = data


class ExecutionWorkerTests(unittest.IsolatedAsyncioTestCase):
    async def test_process_is_idempotent_when_not_queued(self):
        db = AsyncMock()
        db.executions.find_one = AsyncMock(return_value={"_id": "exec-1", "status": "RUNNING"})

        with (
            patch("worker.execution_worker.get_db", AsyncMock(return_value=db)),
            patch("worker.execution_worker.run_workflow", AsyncMock()) as run_workflow,
            patch("worker.execution_worker.publish_status", AsyncMock()),
            patch("worker.execution_worker.publish_done", AsyncMock()),
            patch("worker.execution_worker.publish_error", AsyncMock()),
        ):
            await execution_worker.process(
                Job(
                    {
                        "executionId": "exec-1",
                        "teamId": "team-1",
                        "workflowId": "wf-1",
                        "graph": {"nodes": [], "edges": []},
                        "input": {"task": "hello"},
                    }
                ),
                None,
            )

        run_workflow.assert_not_called()

    async def test_get_queue_metrics_returns_depth_and_oldest_age(self):
        queue = AsyncMock()
        queue.getWaitingCount = AsyncMock(return_value=2)
        queue.getJobs = AsyncMock(
            return_value=[type("JobMeta", (), {"timestamp": 1})()]
        )

        with patch("worker.execution_worker._queue", queue):
            metrics = await execution_worker.get_queue_metrics()

        self.assertEqual(metrics["queue_depth"], 2)
        self.assertGreaterEqual(metrics["oldest_job_age_ms"], 0)


if __name__ == "__main__":
    unittest.main()
