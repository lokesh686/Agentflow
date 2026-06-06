from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    openai_api_key: str = ""
    gemini_api_key: str = ""
    tavily_api_key: str = ""
    pinecone_api_key: str = ""
    pinecone_host: str = ""  # e.g. "my-index-xxxx.svc.us-east1-gcp.pinecone.io"

    mongodb_uri: str = "mongodb://localhost:27017/agentflow_dev"
    redis_url: str = "redis://localhost:6379"

    port: int = 8001
    max_agent_steps: int = 25
    max_execution_time_seconds: int = 300

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
