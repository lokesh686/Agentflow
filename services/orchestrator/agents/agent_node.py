"""
Task 4 — Generic agent node for the LangGraph execution graph.

Each node in the user's workflow graph becomes an AgentNode instance.
The node:
  1. Builds a ReAct-style agent with its configured tools + system prompt
  2. Runs the agent with the current graph state as input
  3. Returns updated state with its output appended
  4. Publishes a step event via Redis pub/sub (Task 5)
"""

import json
import time
from datetime import datetime, timezone
from typing import Any

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langchain.agents import create_react_agent, AgentExecutor
from langchain.prompts import PromptTemplate

from tools.registry import resolve_tools
from events import publish_step
from memory.pinecone_memory import retrieve_memory, store_memory, format_memories_as_context


# ReAct prompt template
REACT_TEMPLATE = """{system_prompt}

You have access to the following tools:
{tools}

Use the following format:
Thought: think about what to do
Action: the action to take (one of [{tool_names}])
Action Input: the input for the action
Observation: the result of the action
... (repeat Thought/Action/Action Input/Observation as needed)
Thought: I now know the final answer
Final Answer: your complete, well-formatted answer

Begin!

{input}
{agent_scratchpad}"""


class AgentNode:
    """
    Wraps a single workflow node as a callable LangGraph node function.
    """

    def __init__(
        self,
        node_id: str,
        node_type: str,
        label: str,
        config: dict[str, Any],
        execution_id: str,
        team_id: str,
        workflow_id: str = "",
    ):
        self.node_id = node_id
        self.node_type = node_type
        self.label = label
        self.config = config
        self.execution_id = execution_id
        self.team_id = team_id
        self.workflow_id = workflow_id

        # Build LLM
        self.llm = ChatOpenAI(
            model=config.get("model", "gpt-4o"),
            temperature=config.get("temperature", 0.7),
            max_tokens=config.get("maxTokens", 2048),
        )

        # Resolve tools from registry
        self.tools = resolve_tools(config.get("tools", []))

        # System prompt
        self.system_prompt = config.get("systemPrompt") or self._default_system_prompt()

    def _default_system_prompt(self) -> str:
        prompts = {
            "research": "You are an expert research agent. Search for accurate, up-to-date information and synthesize it clearly.",
            "writer": "You are an expert writer. Produce clear, engaging, well-structured content based on the information provided.",
            "code": "You are an expert software engineer. Write clean, efficient, well-commented code.",
            "data": "You are a data analyst. Analyze data carefully and provide clear insights with supporting evidence.",
            "decision": "You are a decision-making agent. Evaluate options logically and recommend the best course of action.",
            "notifier": "You are a notification agent. Summarize and format information for clear communication.",
        }
        return prompts.get(self.node_type, "You are a helpful AI assistant.")

    async def __call__(self, state: dict[str, Any]) -> dict[str, Any]:
        """Called by LangGraph when this node is executed."""
        start_time = time.time()
        step_record: dict[str, Any] = {
            "agentName": self.label or self.node_type,
            "nodeId": self.node_id,
            "type": "agent_start",
            "input": state.get("current_input", state.get("task_input", "")),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "attempt": state.get("retry_count", 0) + 1,
        }

        try:
            # Build input from state
            task_input = self._build_input(state)

            # Retrieve relevant memories from Pinecone (Task 11)
            memories = await retrieve_memory(
                team_id=self.team_id,
                query=task_input,
                workflow_id=self.workflow_id,
                top_k=3,
            )
            memory_context = format_memories_as_context(memories)
            if memory_context:
                task_input = f"{memory_context}\n\n{task_input}"

            if self.tools:
                output = await self._run_with_tools(task_input)
            else:
                output = await self._run_simple(task_input)

            latency_ms = int((time.time() - start_time) * 1000)

            # Estimate token usage (approximation; real counts need streaming)
            prompt_tokens = len(task_input.split()) * 2
            completion_tokens = len(output.split()) * 2
            tokens_used = {
                "prompt": prompt_tokens,
                "completion": completion_tokens,
                "total": prompt_tokens + completion_tokens,
            }

            step_record.update({
                "type": "agent_complete",
                "output": output,
                "tokensUsed": tokens_used,
                "latencyMs": latency_ms,
            })

            # Task 5 — publish step event via Redis pub/sub
            await publish_step(self.execution_id, self.team_id, step_record)

            # Task 11 — store output in Pinecone memory
            await store_memory(
                team_id=self.team_id,
                workflow_id=self.workflow_id,
                execution_id=self.execution_id,
                node_id=self.node_id,
                agent_name=self.label or self.node_type,
                content=output,
            )

            # Update graph state
            new_state = {**state}
            outputs = list(state.get("agent_outputs", []))
            outputs.append({
                "nodeId": self.node_id,
                "agentName": self.label or self.node_type,
                "output": output,
            })
            new_state["agent_outputs"] = outputs
            new_state["current_input"] = output  # chain output to next agent
            new_state["last_error"] = None

            return new_state

        except Exception as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            step_record.update({
                "type": "agent_failed",
                "error": str(exc),
                "latencyMs": latency_ms,
            })
            await publish_step(self.execution_id, self.team_id, step_record)

            new_state = {**state, "last_error": str(exc)}
            return new_state

    def _build_input(self, state: dict[str, Any]) -> str:
        """Build the agent's input from the current graph state."""
        task_input = state.get("task_input", "")
        current = state.get("current_input", "")
        prior_outputs = state.get("agent_outputs", [])

        if not prior_outputs:
            return f"Task: {task_input}"

        prior_context = "\n\n".join(
            f"[{o['agentName']}]: {o['output']}" for o in prior_outputs[-3:]
        )
        return (
            f"Original Task: {task_input}\n\n"
            f"Prior agent outputs:\n{prior_context}\n\n"
            f"Your input: {current or task_input}"
        )

    async def _run_with_tools(self, task_input: str) -> str:
        """Run agent with ReAct loop using registered tools."""
        prompt = PromptTemplate.from_template(REACT_TEMPLATE).partial(
            system_prompt=self.system_prompt
        )
        agent = create_react_agent(self.llm, self.tools, prompt)
        executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            max_iterations=8,
            handle_parsing_errors=True,
            verbose=False,
        )
        result = await executor.ainvoke({"input": task_input})
        return result.get("output", "")

    async def _run_simple(self, task_input: str) -> str:
        """Run agent without tools — direct LLM call."""
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=task_input),
        ]
        response = await self.llm.ainvoke(messages)
        return response.content
