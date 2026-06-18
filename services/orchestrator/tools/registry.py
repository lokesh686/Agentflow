from .web_search import get_web_search_tool

TOOL_REGISTRY = {
    "web_search": get_web_search_tool,
}

def resolve_tools(tool_names: list[str]) -> list:
    tools = []
    for name in tool_names:
        if name in TOOL_REGISTRY:
            tools.append(TOOL_REGISTRY[name]())
    return tools
