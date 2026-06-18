import re
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

async def exact_match_scorer(expected: str, actual: str) -> float:
    """Returns 1.0 if actual exactly matches expected, else 0.0"""
    return 1.0 if str(expected).strip().lower() == str(actual).strip().lower() else 0.0

async def regex_scorer(expected_regex: str, actual: str) -> float:
    """Returns 1.0 if actual matches the expected regex, else 0.0"""
    try:
        return 1.0 if re.search(expected_regex, str(actual)) else 0.0
    except re.error:
        return 0.0

async def llm_judge_scorer(expected: str, actual: str, input_data: Any) -> float:
    """Uses an LLM to grade the output on a scale of 0 to 1."""
    try:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        prompt = (
            f"You are an impartial judge evaluating an AI agent's response.\n\n"
            f"Input to agent: {input_data}\n"
            f"Expected output/concept: {expected}\n"
            f"Actual agent output: {actual}\n\n"
            f"Rate the actual output on a scale from 0.0 to 1.0 based on how well it matches the expected output's intent and accuracy.\n"
            f"Return ONLY the floating point number. No other text."
        )
        result = await llm.ainvoke([SystemMessage(content=prompt)])
        score_str = result.content.strip()
        # Extract float from string if possible
        match = re.search(r"0\.\d+|1\.0|0|1", score_str)
        if match:
            return float(match.group(0))
        return 0.0
    except Exception as e:
        print(f"LLM Judge error: {e}")
        return 0.0

async def score_output(expected: str, actual: str, scorer_type: str, input_data: Any) -> float:
    if scorer_type == "exact_match":
        return await exact_match_scorer(expected, actual)
    elif scorer_type == "regex":
        return await regex_scorer(expected, actual)
    elif scorer_type == "llm_judge":
        return await llm_judge_scorer(expected, actual, input_data)
    else:
        return 0.0
