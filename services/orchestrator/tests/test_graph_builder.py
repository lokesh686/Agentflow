import pytest
from unittest.mock import AsyncMock, patch
from services.orchestrator.agents.graph_builder import build_graph

@pytest.mark.asyncio
@patch('services.orchestrator.agents.graph_builder.get_db')
@patch('services.orchestrator.agents.agent_node.ChatOpenAI')
async def test_build_graph_simple(mock_chat_openai, mock_get_db):
    mock_chat_openai.return_value = None
    mock_db = AsyncMock()
    mock_get_db.return_value = mock_db
    mock_db.promptversions.find_one.return_value = None
    
    workflow_graph = {
        "nodes": [
            {"id": "a", "type": "custom", "label": "Agent A"},
            {"id": "b", "type": "custom", "label": "Agent B"},
        ],
        "edges": [
            {"source": "a", "target": "b"},
        ],
    }
    graph = await build_graph(workflow_graph, "exec_1", "team_1")
    assert graph is not None
    assert "a" in graph.nodes
    assert "b" in graph.nodes
