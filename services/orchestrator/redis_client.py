import redis.asyncio as aioredis
from .config import get_settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = await aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def close_redis():
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


# ── Channel naming helpers ───────────────────────────────────────────────────

def execution_channel(execution_id: str) -> str:
    """Pub/sub channel for real-time execution events."""
    return f"execution:{execution_id}:events"


def team_channel(team_id: str) -> str:
    """Pub/sub channel for team-level events."""
    return f"team:{team_id}:events"


EXECUTION_QUEUE = "execution:queue"
