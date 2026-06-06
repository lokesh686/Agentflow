"""
AgentFlow Pro — Orchestrator Service
Runs the LangGraph execution engine + Redis queue worker.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from db import get_db, close_db
from redis_client import get_redis, close_redis
from worker import worker_loop
from api.routes import router as api_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("orchestrator")

_worker_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to Redis + MongoDB, start queue worker."""
    global _worker_task
    settings = get_settings()

    logger.info("Connecting to Redis...")
    await get_redis()

    logger.info("Connecting to MongoDB...")
    await get_db()

    logger.info("Starting execution worker loop...")
    _worker_task = asyncio.create_task(worker_loop())

    logger.info(f"Orchestrator ready on port {settings.port}")
    yield

    # Shutdown
    logger.info("Shutting down orchestrator...")
    if _worker_task:
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass

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
    return {"status": "ok", "service": "orchestrator"}
