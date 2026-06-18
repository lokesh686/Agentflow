"""
Task 4 — LangGraph StateGraph builder.

Takes the workflow graph definition (nodes + edges) stored in MongoDB
and compiles it into a LangGraph StateGraph that can be invoked.

Graph state shape:
{
  "task_input": str,         # original user input
  "current_input": str,      # output of last agent (chained)
  "agent_outputs": list,     # all step outputs accumulated
  "last_error": str | None,  # last agent error if any
  "retry_count": int,        # retry counter
}
"""

import random
from typing import Any, TypedDict
from langgraph.graph import StateGraph, END

from .agent_node import AgentNode
from .supervisor_node import SupervisorNode
from ..events import publish_status
from ..db import get_db


class GraphState(TypedDict):
    task_input: str
    current_input: str
    agent_outputs: list
    last_error: str | None
    retry_count: int


async def build_graph(
    workflow_graph: dict[str, Any],
    execution_id: str,
    team_id: str,
    workflow_id: str = "",
) -> StateGraph:
    """
    Compile a workflow graph definition into a LangGraph StateGraph.

    Args:
        workflow_graph: { nodes: [...], edges: [...] } from MongoDB
        execution_id: for event publishing
        team_id: for event publishing

    Returns:
        A compiled LangGraph graph ready for .ainvoke()
    """
    nodes: list[dict] = workflow_graph.get("nodes", [])
    edges: list[dict] = workflow_graph.get("edges", [])

    if not nodes:
        raise ValueError("Workflow must have at least one agent node")

    builder = StateGraph(GraphState)

    # ── Register agent nodes ─────────────────────────────────────────────────
    node_map: dict[str, AgentNode] = {}
    db = await get_db()
    for node_def in nodes:
        config = node_def.get("config", {})
        ab_test = config.get("abTestConfig")
        if ab_test and ab_test.get("variantA") and ab_test.get("variantB"):
            # Execute A/B test routing logic
            roll = random.random() * 100
            split = ab_test.get("splitPercent", 50)
            chosen_version = ab_test["variantA"] if roll <= split else ab_test["variantB"]
            
            # Fetch the prompt version
            prompt_doc = await db.promptversions.find_one({
                "workflowId": workflow_id,
                "nodeId": node_def["id"],
                "version": chosen_version
            })
            if prompt_doc:
                config["systemPrompt"] = prompt_doc.get("content", config.get("systemPrompt", ""))

        node_type = node_def.get("type", "custom")
        if node_type == "supervisor":
            agent = SupervisorNode(
                node_id=node_def["id"],
                label=node_def.get("label", node_def["id"]),
                config=config,
                execution_id=execution_id,
                team_id=team_id,
                workflow_id=workflow_id,
            )
        else:
            agent = AgentNode(
                node_id=node_def["id"],
                node_type=node_type,
                label=node_def.get("label", node_def["id"]),
                config=config,
                execution_id=execution_id,
                team_id=team_id,
                workflow_id=workflow_id,
            )
        
        node_map[node_def["id"]] = agent
        builder.add_node(node_def["id"], agent)

    # ── Determine entry point ────────────────────────────────────────────────
    # Entry = node(s) with no incoming edges
    targets = {e["target"] for e in edges}
    entry_nodes = [n["id"] for n in nodes if n["id"] not in targets]

    if not entry_nodes:
        # Cycle detected or single node — use first node
        entry_nodes = [nodes[0]["id"]]

    builder.set_entry_point(entry_nodes[0])

    # ── Wire edges ───────────────────────────────────────────────────────────
    # Build adjacency: source → list of (target, condition)
    adjacency: dict[str, list[dict]] = {}
    for edge in edges:
        src = edge["source"]
        adjacency.setdefault(src, []).append(edge)

    # Nodes with no outgoing edges → connect to END
    source_ids = {e["source"] for e in edges}

    for node_def in nodes:
        nid = node_def["id"]
        outgoing = adjacency.get(nid, [])

        if not outgoing:
            builder.add_edge(nid, END)
            continue

        # Simple case: one unconditional edge
        if len(outgoing) == 1 and outgoing[0].get("condition", {}).get("type", "always") == "always":
            builder.add_edge(nid, outgoing[0]["target"])
            continue

        # Conditional routing
        def make_router(edges_out):
            def router(state: GraphState) -> str:
                for edge in edges_out:
                    cond = edge.get("condition", {})
                    ctype = cond.get("type", "always")

                    if ctype == "always":
                        return edge["target"]
                    elif ctype == "on_success" and not state.get("last_error"):
                        return edge["target"]
                    elif ctype == "on_error" and state.get("last_error"):
                        return edge["target"]
                    elif ctype == "contains":
                        val = cond.get("value", "")
                        current = state.get("current_input", "")
                        if val.lower() in current.lower():
                            return edge["target"]

                # Default: go to first target
                return edges_out[0]["target"]

            return router

        targets_list = [e["target"] for e in outgoing]
        builder.add_conditional_edges(nid, make_router(outgoing), {t: t for t in targets_list})

    return builder.compile()


async def run_workflow(
    workflow_graph: dict[str, Any],
    task_input: str,
    execution_id: str,
    team_id: str,
    workflow_id: str = "",
) -> str:
    """
    Compile and run a workflow graph to completion.
    Returns the final agent output string.
    """
    from config import get_settings
    settings = get_settings()

    graph = await build_graph(workflow_graph, execution_id, team_id, workflow_id)

    initial_state: GraphState = {
        "task_input": task_input,
        "current_input": task_input,
        "agent_outputs": [],
        "last_error": None,
        "retry_count": 0,
    }

    # LangGraph config: recursion limit = max agent steps
    config = {"recursion_limit": settings.max_agent_steps}

    final_state = await graph.ainvoke(initial_state, config=config)

    outputs = final_state.get("agent_outputs", [])
    if outputs:
        return outputs[-1].get("output", "")
    return "Workflow completed with no output."
