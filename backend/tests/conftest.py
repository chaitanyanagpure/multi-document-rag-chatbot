"""
VerbaFlow AI - Pytest Configurations
Defines fixtures for async test database engine, mock sessions, and fastapi test clients.
"""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator, Generator
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

from sqlalchemy.dialects.sqlite.base import SQLiteTypeCompiler

# Monkey-patch SQLiteTypeCompiler to handle ARRAY type compilation in SQLite
def visit_ARRAY(self, type_, **kw):
    return "TEXT"

SQLiteTypeCompiler.visit_ARRAY = visit_ARRAY

from app.core.database import Base
from app.main import app

# Create in-memory SQLite for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    """Create test tables on test run start."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional database session for unit tests."""
    async with TestingSessionLocal() as session:
        yield session
        # rollback changes after each test
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """FastAPI AsyncClient configured with test database dependencies."""
    from app.core.database import get_db
    
    # Override get_db dependency in FastAPI app
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    
    async with AsyncClient(transport=ASGITransport(app), base_url="http://test") as ac:
        yield ac
        
    app.dependency_overrides.clear()
