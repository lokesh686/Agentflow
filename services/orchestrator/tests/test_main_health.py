import unittest
from unittest.mock import AsyncMock, patch

import main


class HealthEndpointTests(unittest.IsolatedAsyncioTestCase):
    async def test_health_includes_queue_metrics(self):
        with (
            patch("main.get_db", AsyncMock(return_value=AsyncMock(command=AsyncMock(return_value={"ok": 1})))),
            patch("main.get_redis", AsyncMock(return_value=AsyncMock(ping=AsyncMock(return_value=True)))),
            patch("main.get_queue_metrics", AsyncMock(return_value={"queue_depth": 4, "oldest_job_age_ms": 1234})),
        ):
            payload = await main.health()

        self.assertEqual(payload["mongo"], "ok")
        self.assertEqual(payload["redis"], "ok")
        self.assertEqual(payload["orchestrator"], "ok")
        self.assertEqual(payload["queue_depth"], 4)
        self.assertEqual(payload["oldest_job_age_ms"], 1234)
        self.assertIn("uptime_seconds", payload)


if __name__ == "__main__":
    unittest.main()
