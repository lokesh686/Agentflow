"""
Task 4 — Agent tools available to all agents in the graph.

Each tool is a LangChain @tool decorated function.
Tools are registered in TOOL_REGISTRY keyed by name so
node configs can reference them by string: ["web_search", "url_scraper"].
"""

import json
import httpx
from datetime import datetime
from langchain_core.tools import tool
from config import get_settings


# ── Web Search ───────────────────────────────────────────────────────────────

@tool
async def web_search(query: str) -> str:
    """Search the web for current information. Returns top results as JSON."""
    settings = get_settings()
    if not settings.tavily_api_key:
        return json.dumps({"error": "TAVILY_API_KEY not configured"})

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.tavily_api_key,
                "query": query,
                "search_depth": "basic",
                "max_results": 5,
                "include_answer": True,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    results = [
        {"title": r["title"], "url": r["url"], "content": r["content"][:500]}
        for r in data.get("results", [])
    ]
    return json.dumps({
        "answer": data.get("answer", ""),
        "results": results,
    })


# ── URL Scraper ──────────────────────────────────────────────────────────────

@tool
async def url_scraper(url: str) -> str:
    """Fetch and return the text content of a URL (first 3000 chars)."""
    try:
        async with httpx.AsyncClient(
            timeout=10,
            follow_redirects=True,
            headers={"User-Agent": "AgentFlow/1.0"},
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            # Return raw text; agent will parse what it needs
            text = resp.text[:3000]
            return json.dumps({"url": url, "content": text, "status": resp.status_code})
    except Exception as e:
        return json.dumps({"error": str(e), "url": url})


# ── Python Code Executor ─────────────────────────────────────────────────────

@tool
def code_executor(code: str) -> str:
    """
    Execute a Python snippet in a sandboxed namespace and return stdout/result.
    Only safe builtins are available. No file system or network access.
    """
    import io
    import sys
    import contextlib

    safe_builtins = {
        "print": print, "len": len, "range": range, "enumerate": enumerate,
        "zip": zip, "map": map, "filter": filter, "sorted": sorted,
        "sum": sum, "min": max, "max": max, "abs": abs, "round": round,
        "int": int, "float": float, "str": str, "bool": bool, "list": list,
        "dict": dict, "set": set, "tuple": tuple, "type": type,
        "isinstance": isinstance, "hasattr": hasattr, "getattr": getattr,
        "__import__": None,  # Block imports
    }

    stdout_capture = io.StringIO()
    namespace: dict = {"__builtins__": safe_builtins}
    error = None
    result = None

    try:
        with contextlib.redirect_stdout(stdout_capture):
            exec(compile(code, "<agent_code>", "exec"), namespace)  # noqa: S102
        result = namespace.get("result")
    except Exception as e:
        error = str(e)

    return json.dumps({
        "stdout": stdout_capture.getvalue(),
        "result": str(result) if result is not None else None,
        "error": error,
    })


# ── Data Analyzer ────────────────────────────────────────────────────────────

@tool
def data_analyzer(data: str, operation: str) -> str:
    """
    Perform basic analytics on JSON data.

    operations: "summary" | "count" | "unique" | "sort"
    data: JSON string of a list of dicts or list of values
    """
    try:
        parsed = json.loads(data)
    except json.JSONDecodeError as e:
        return json.dumps({"error": f"Invalid JSON: {e}"})

    try:
        if operation == "summary":
            if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                keys = list(parsed[0].keys())
                return json.dumps({"rows": len(parsed), "columns": keys, "sample": parsed[:3]})
            return json.dumps({"items": len(parsed), "sample": parsed[:5]})

        elif operation == "count":
            return json.dumps({"count": len(parsed)})

        elif operation == "unique":
            if isinstance(parsed, list):
                unique = list({json.dumps(i, sort_keys=True) for i in parsed})
                return json.dumps({"unique_count": len(unique)})

        elif operation == "sort":
            if isinstance(parsed, list):
                try:
                    sorted_data = sorted(parsed)
                    return json.dumps({"sorted": sorted_data[:20]})
                except TypeError:
                    return json.dumps({"error": "Items are not sortable"})

        return json.dumps({"error": f"Unknown operation: {operation}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


# ── Current Date/Time ────────────────────────────────────────────────────────

@tool
def get_current_datetime() -> str:
    """Return the current UTC date and time."""
    return json.dumps({"utc": datetime.utcnow().isoformat() + "Z"})


# ── Tool Registry ────────────────────────────────────────────────────────────

ALL_TOOLS = [
    web_search,
    url_scraper,
    code_executor,
    data_analyzer,
    get_current_datetime,
]

TOOL_REGISTRY: dict = {t.name: t for t in ALL_TOOLS}


def resolve_tools(tool_names: list[str]):
    """Return tool instances for the given list of tool name strings."""
    resolved = []
    for name in tool_names:
        if name in TOOL_REGISTRY:
            resolved.append(TOOL_REGISTRY[name])
    return resolved
