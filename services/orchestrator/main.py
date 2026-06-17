"""
AgentFlow Pro — Orchestrator Service
Runs the LangGraph execution engine + Redis queue worker.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from time import monotonic

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db import get_db, close_db
from redis_client import get_redis, close_redis
from worker.execution_worker import get_queue_metrics, start_worker, stop_worker
from api.routes import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("orchestrator")

_worker: object | None = None
_started_at = monotonic()


def validate_env_or_raise() -> None:
    settings = get_settings()
    required = {
        "MONGODB_URI": settings.mongodb_uri,
        "REDIS_URL": settings.redis_url,
        "API_GATEWAY_URL": settings.api_gateway_url,
    }
    missing = [name for name, value in required.items() if not value or not str(value).strip()]
    if missing:
        raise RuntimeError(f"Missing required environment variables: {', '.join(missing)}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to Redis + MongoDB, start queue worker."""
    global _worker
    validate_env_or_raise()
    settings = get_settings()

    logger.info("Connecting to Redis...")
    await get_redis()

    logger.info("Connecting to MongoDB...")
    await get_db()

    logger.info("Starting execution worker...")
    _worker = await start_worker()

    logger.info(f"Orchestrator ready on port {settings.port}")
    yield

    # Shutdown
    logger.info("Shutting down orchestrator...")
    if _worker:
        await stop_worker()

    await close_redis()
    await close_db()
    logger.info("Orchestrator stopped")


app = FastAPI(
    title="AgentFlow Pro Orchestrator",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health():
    mongo = "error"
    redis = "error"
    try:
        db = await get_db()
        await db.command("ping")
        mongo = "ok"
    except Exception:
        mongo = "error"

    try:
        redis_client = await get_redis()
        await redis_client.ping()
        redis = "ok"
    except Exception:
        redis = "error"

    metrics = await get_queue_metrics()
    return {
        "mongo": mongo,
        "redis": redis,
        "orchestrator": "ok",
        "uptime_seconds": int(monotonic() - _started_at),
        **metrics,
    }
