import asyncio
from bson.objectid import ObjectId
from datetime import datetime

from ..db import get_db
from ..agents.graph_builder import run_workflow
from .scorers import score_output

async def run_evaluation(eval_run_id: str):
    """
    Executes a dataset of test cases against a workflow.
    """
    db = await get_db()
    eval_run = await db.evalruns.find_one({"_id": ObjectId(eval_run_id)})
    if not eval_run:
        print(f"EvalRun {eval_run_id} not found")
        return

    workflow_id = eval_run["workflowId"]
    team_id = eval_run["teamId"]
    
    workflow = await db.workflows.find_one({"_id": ObjectId(workflow_id)})
    if not workflow:
        await db.evalruns.update_one(
            {"_id": ObjectId(eval_run_id)},
            {"$set": {"status": "failed", "completedAt": datetime.utcnow()}}
        )
        return

    cases = eval_run.get("cases", [])
    total_score = 0
    updated_cases = []

    # Run cases sequentially for now, could be parallelized
    for case in cases:
        input_data = case.get("input", "")
        expected = case.get("expected", "")
        scorer_type = case.get("scorer", "llm_judge")
        
        # We need a dummy execution ID for the orchestrator events
        dummy_exec_id = f"eval_{eval_run_id}_{ObjectId()}"
        
        try:
            # Run the workflow
            actual_output = await run_workflow(
                workflow_graph=workflow["graph"],
                task_input=str(input_data),
                execution_id=dummy_exec_id,
                team_id=team_id,
                workflow_id=workflow_id
            )
            
            # Score it
            score = await score_output(expected, actual_output, scorer_type, input_data)
        except Exception as e:
            print(f"Eval case failed: {e}")
            actual_output = f"Error: {str(e)}"
            score = 0.0
            
        case["actual"] = actual_output
        case["score"] = score
        updated_cases.append(case)
        total_score += score

    # Calculate final average score
    avg_score = total_score / len(cases) if cases else 0
    
    await db.evalruns.update_one(
        {"_id": ObjectId(eval_run_id)},
        {
            "$set": {
                "status": "completed",
                "score": avg_score,
                "cases": updated_cases,
                "completedAt": datetime.utcnow()
            }
        }
    )
    
    # Regression alert could be wired here if avg_score drops below a threshold
