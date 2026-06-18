import pytest_asyncio
from mongomock_motor import AsyncMongoMockClient

@pytest_asyncio.fixture
async def mock_db():
    client = AsyncMongoMockClient()
    db = client.get_database("test_db")
    yield db
    client.close()
