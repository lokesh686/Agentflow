import pinecone
from langchain_openai import OpenAIEmbeddings
from ..config import get_settings

def get_pinecone_index():
    settings = get_settings()
    if not settings.pinecone_api_key or not settings.pinecone_host:
        return None
    
    pinecone.init(api_key=settings.pinecone_api_key, host=settings.pinecone_host)
    return pinecone.Index("agentflow-memory")

def retrieve_memory(query: str, team_id: str, workflow_id: str, top_k: int = 5):
    index = get_pinecone_index()
    if index is None:
        return []

    embeddings = OpenAIEmbeddings()
    query_vector = embeddings.embed_query(query)
    
    results = index.query(
        vector=query_vector,
        top_k=top_k,
        filter={"team_id": team_id, "workflow_id": workflow_id},
        include_metadata=True,
    )
    return results["matches"]

def store_memory(team_id: str, workflow_id: str, execution_id: str, node_id: str, agent_name: str, content: str):
    index = get_pinecone_index()
    if index is None:
        return

    embeddings = OpenAIEmbeddings()
    vector = embeddings.embed_query(content)
    
    index.upsert(
        vectors=[
            {
                "id": f"{execution_id}-{node_id}",
                "values": vector,
                "metadata": {
                    "team_id": team_id,
                    "workflow_id": workflow_id,
                    "execution_id": execution_id,
                    "node_id": node_id,
                    "agent_name": agent_name,
                    "content": content,
                },
            }
        ]
    )

def format_memories_as_context(memories: list) -> str:
    if not memories:
        return ""
    
    context = "Relevant context from past runs:\n"
    for memory in memories:
        context += f"- {memory['metadata']['content']}\n"
    return context
