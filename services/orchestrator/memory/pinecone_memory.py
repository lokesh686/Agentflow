"""
Task 11 — Pinecone vector memory for agents.

Each workflow execution can store its outputs as vector embeddings in Pinecone.
On subsequent runs, agents retrieve semantically similar past outputs as context,
enabling persistent memory across executions.
"""

import json
import hashlib
from datetime import datetime, timezone
from typing import Any

import httpx
from config import get_settings


EMBEDDING_MODEL = "text-embedding-3-small"
PINECONE_INDEX  = "agentflow-memory"
NAMESPACE_PREFIX = "team"
TOP_K = 5


# ── Embedding ─────────────────────────────────────────────────────────────────

async def embed(text: str) -> list[float]:
    """Generate an embedding vector using OpenAI text-embedding-3-small."""
    settings = get_settings()
    if not settings.openai_api_key:
        return []

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {settings.openai_api_key}"},
            json={"input": text[:8000], "model": EMBEDDING_MODEL},
        )
        resp.raise_for_status()
        return resp.json()["data"][0]["embedding"]


# ── Pinecone helpers ──────────────────────────────────────────────────────────

def _pinecone_headers() -> dict:
    settings = get_settings()
    return {
        "Api-Key": getattr(settings, "pinecone_api_key", ""),
        "Content-Type": "application/json",
    }


def _pinecone_url(path: str) -> str:
    settings = get_settings()
    host = getattr(settings, "pinecone_host", "")
    return f"https://{host}{path}"


def _namespace(team_id: str) -> str:
    return f"{NAMESPACE_PREFIX}-{team_id}"


def _vector_id(execution_id: str, node_id: str) -> str:
    key = f"{execution_id}:{node_id}"
    return hashlib.sha1(key.encode()).hexdigest()[:20]


# ── Store ─────────────────────────────────────────────────────────────────────

async def store_memory(
    team_id: str,
    workflow_id: str,
    execution_id: str,
    node_id: str,
    agent_name: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> bool:
    """
    Embed and upsert an agent output into Pinecone.
    Returns True on success, False if Pinecone is not configured.
    """
    settings = get_settings()
    if not getattr(settings, "pinecone_api_key", "") or not getattr(settings, "pinecone_host", ""):
        return False

    vector = await embed(content)
    if not vector:
        return False

    record = {
        "vectors": [
            {
                "id": _vector_id(execution_id, node_id),
                "values": vector,
                "metadata": {
                    "teamId": team_id,
                    "workflowId": workflow_id,
                    "executionId": execution_id,
                    "nodeId": node_id,
                    "agentName": agent_name,
                    "content": content[:1000],  # metadata cap
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    **(metadata or {}),
                },
            }
        ]
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _pinecone_url(f"/vectors/upsert?namespace={_namespace(team_id)}"),
            headers=_pinecone_headers(),
            json=record,
        )
        return resp.status_code == 200


# ── Retrieve ──────────────────────────────────────────────────────────────────

async def retrieve_memory(
    team_id: str,
    query: str,
    workflow_id: str | None = None,
    top_k: int = TOP_K,
) -> list[dict[str, Any]]:
    """
    Query Pinecone for semantically similar past agent outputs.
    Returns a list of memory records with content + metadata.
    """
    settings = get_settings()
    if not getattr(settings, "pinecone_api_key", "") or not getattr(settings, "pinecone_host", ""):
        return []

    vector = await embed(query)
    if not vector:
        return []

    body: dict[str, Any] = {
        "vector": vector,
        "topK": top_k,
        "includeMetadata": True,
        "namespace": _namespace(team_id),
    }
    if workflow_id:
        body["filter"] = {"workflowId": {"$eq": workflow_id}}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            _pinecone_url("/query"),
            headers=_pinecone_headers(),
            json=body,
        )
        if resp.status_code != 200:
            return []

    matches = resp.json().get("matches", [])
    return [
        {
            "score": m["score"],
            "content": m["metadata"].get("content", ""),
            "agentName": m["metadata"].get("agentName", ""),
            "executionId": m["metadata"].get("executionId", ""),
            "timestamp": m["metadata"].get("timestamp", ""),
        }
        for m in matches
        if m["score"] >= 0.75  # relevance threshold
    ]


# ── Format for injection ──────────────────────────────────────────────────────

def format_memories_as_context(memories: list[dict]) -> str:
    """Format retrieved memories into a prompt-injectable context block."""
    if not memories:
        return ""

    lines = ["[Relevant past knowledge from previous executions:]"]
    for m in memories:
        ts = m.get("timestamp", "")[:10]
        agent = m.get("agentName", "Agent")
        score = m.get("score", 0)
        content = m.get("content", "").strip()
        lines.append(f"\n[{agent} | {ts} | relevance {score:.2f}]\n{content}")

    return "\n".join(lines)
