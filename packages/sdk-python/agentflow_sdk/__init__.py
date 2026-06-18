import httpx
from typing import Any, Dict, Optional
from pydantic import BaseModel

class AgentFlowError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None, data: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.data = data

class AgentFlowClient:
    def __init__(self, api_key: str, base_url: str = "https://api.agentflow.com/v1"):
        self.base_url = base_url
        self.client = httpx.Client(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )

    def _handle_response(self, response: httpx.Response) -> Any:
        try:
            response.raise_for_status()
            return response.json().get("data", response.json())
        except httpx.HTTPStatusError as e:
            error_msg = e.response.json().get("error", str(e))
            raise AgentFlowError(error_msg, e.response.status_code, e.response.json())
        except Exception as e:
            raise AgentFlowError(str(e))

    class _Workflows:
        def __init__(self, client: "AgentFlowClient"):
            self._client = client

        def list(self) -> list:
            return self._client._handle_response(self._client.client.get("/workflows"))

        def create(self, data: dict) -> dict:
            return self._client._handle_response(self._client.client.post("/workflows", json=data))

        def execute(self, workflow_id: str, input_data: dict) -> dict:
            return self._client._handle_response(
                self._client.client.post(f"/workflows/{workflow_id}/execute", json={"input": input_data})
            )

    class _Executions:
        def __init__(self, client: "AgentFlowClient"):
            self._client = client

        def get(self, execution_id: str) -> dict:
            return self._client._handle_response(self._client.client.get(f"/executions/{execution_id}"))

        def cancel(self, execution_id: str) -> dict:
            return self._client._handle_response(self._client.client.post(f"/executions/{execution_id}/cancel"))

    @property
    def workflows(self):
        return self._Workflows(self)

    @property
    def executions(self):
        return self._Executions(self)

class AsyncAgentFlowClient:
    def __init__(self, api_key: str, base_url: str = "https://api.agentflow.com/v1"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            base_url=base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
    # Async methods follow similar pattern...
