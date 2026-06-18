from typing import Literal

ModelIntent = Literal["fast", "powerful", "vision"]

MODEL_MAP = {
    "fast": "gpt-3.5-turbo",
    "powerful": "gpt-4o",
    "vision": "gpt-4-vision-preview",
}

def route_model(intent: ModelIntent = "fast") -> str:
    return MODEL_MAP.get(intent, "gpt-3.5-turbo")
