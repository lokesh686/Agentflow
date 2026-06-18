import pytest
from unittest.mock import patch
from services.orchestrator.agents.graph_builder import build_graph

@patch('services.orchestrator.agents.agent_node.ChatOpenAI')
def test_build_graph_simple(mock_chat_openai):
    mock_chat_openai.return_value = None
    workflow_graph = {
        "nodes": [
            {"id": "a", "type": "custom", "label": "Agent A"},
            {"id": "b", "type": "custom", "label": "Agent B"},
        ],
        "edges": [
            {"source": "a", "target": "b"},
        ],
    }
    graph = build_graph(workflow_graph, "exec_1", "team_1")
    assert graph is not None
    assert "a" in graph.nodes
    assert "b" in graph.nodes
