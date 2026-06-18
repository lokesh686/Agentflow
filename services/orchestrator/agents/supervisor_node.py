import asyncio
import json
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from ..db import get_db
from ..events import publish_step

class SupervisorNode:
    """
    Spawns sub-agent graphs (workflows) as separate runs.
    Aggregates results based on aggregation_strategy (sequential, parallel, vote).
    """

    def __init__(
        self,
        node_id: str,
        label: str,
        config: dict[str, Any],
        execution_id: str,
        team_id: str,
        workflow_id: str = "",
    ):
        self.node_id = node_id
        self.label = label
        self.config = config
        self.execution_id = execution_id
        self.team_id = team_id
        self.workflow_id = workflow_id
        
        self.sub_agents = config.get("sub_agents", [])
        self.strategy = config.get("aggregation_strategy", "parallel")
        self.llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    async def _run_sub_workflow(self, sub_workflow_id: str, task_input: str) -> str:
        db = await get_db()
        workflow = await db.workflows.find_one({"_id": sub_workflow_id})
        if not workflow:
            return f"Error: Sub-workflow {sub_workflow_id} not found."
            
        from .graph_builder import run_workflow
        # Generate a child execution ID
        child_exec_id = f"{self.execution_id}_child_{sub_workflow_id}"
        
        try:
            result = await run_workflow(
                workflow_graph=workflow["graph"],
                task_input=task_input,
                execution_id=child_exec_id,
                team_id=self.team_id,
                workflow_id=str(workflow["_id"])
            )
            return result
        except Exception as e:
            return f"Error running {sub_workflow_id}: {str(e)}"

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        task_input = state.get("task_input", "")
        current = state.get("current_input", "")
        input_to_pass = current if current else task_input

        # Output payload for events
        event_data = {
            "nodeId": self.node_id,
            "label": self.label,
            "status": "running",
            "strategy": self.strategy
        }
        await publish_step(self.execution_id, self.team_id, event_data)

        results = []
        
        if self.strategy == "sequential":
            # Pass output of agent N to agent N+1
            curr_input = input_to_pass
            for sa in self.sub_agents:
                wf_id = sa.get("workflowId")
                if wf_id:
                    curr_input = await self._run_sub_workflow(wf_id, curr_input)
                    results.append(curr_input)
            final_output = curr_input

        elif self.strategy == "parallel":
            # Run all at once, then synthesize
            tasks = []
            for sa in self.sub_agents:
                wf_id = sa.get("workflowId")
                if wf_id:
                    tasks.append(self._run_sub_workflow(wf_id, input_to_pass))
            
            gathered = await asyncio.gather(*tasks)
            results = list(gathered)
            
            # Synthesize
            synthesis_prompt = "You are a supervisor agent. Synthesize the following reports from sub-agents into a single cohesive response:\n\n"
            for i, res in enumerate(results):
                synthesis_prompt += f"--- Report {i+1} ---\n{res}\n\n"
                
            response = await self.llm.ainvoke([
                SystemMessage(content=synthesis_prompt),
                HumanMessage(content=f"Original task: {input_to_pass}")
            ])
            final_output = response.content

        elif self.strategy == "vote":
            # Run all at once, pick the most common answer or use LLM to vote
            tasks = [self._run_sub_workflow(sa.get("workflowId"), input_to_pass) for sa in self.sub_agents if sa.get("workflowId")]
            gathered = await asyncio.gather(*tasks)
            results = list(gathered)
            
            voting_prompt = "You are a voting supervisor. Based on the following answers from sub-agents, determine the consensus or best answer. If there is a tie, break it logically.\n\n"
            for i, res in enumerate(results):
                voting_prompt += f"--- Answer {i+1} ---\n{res}\n\n"
                
            response = await self.llm.ainvoke([
                SystemMessage(content=voting_prompt),
                HumanMessage(content=f"Original task: {input_to_pass}")
            ])
            final_output = response.content
        else:
            final_output = "Unknown aggregation strategy."

        # Update state
        outputs = state.get("outputs", {})
        outputs[self.node_id] = final_output

        await publish_step(self.execution_id, self.team_id, {
            "nodeId": self.node_id,
            "status": "completed",
            "output": final_output
        })

        return {
            "current_node": self.node_id,
            "current_input": final_output,
            "outputs": outputs
        }
