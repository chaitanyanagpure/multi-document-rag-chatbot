"""
VerbaFlow AI - Auth Router Tests
Validates email checks, password hashing, and token issuance workflows.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient, db_session: AsyncSession):
    payload = {
        "email": "testadmin@company.com",
        "password": "Secure_pass_123",
        "full_name": "Test Administrator",
        "organization_name": "Company Inc."
    }
    
    response = await client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    
    data = response.json()
    assert data["user"]["email"] == payload["email"]
    assert "id" in data["user"]
    assert data["user"]["role"] == "ORG_ADMIN"

    # Verify database record
    stmt = select(User).where(User.email == payload["email"])
    db_res = await db_session.execute(stmt)
    db_user = db_res.scalar_one_or_none()
    assert db_user is not None
    assert db_user.full_name == "Test Administrator"


@pytest.mark.asyncio
async def test_login_user(client: AsyncClient, db_session: AsyncSession):
    # Register first
    payload = {
        "email": "login_test@company.com",
        "password": "Secure_pass_123",
        "full_name": "Login User",
        "organization_name": "Company Inc."
    }
    await client.post("/api/v1/auth/register", json=payload)

    # Login
    login_payload = {
        "email": payload["email"],
        "password": payload["password"]
    }
    response = await client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200
    
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_invalid_password(client: AsyncClient):
    payload = {
        "email": "login_test@company.com",
        "password": "wrong_password"
    }
    response = await client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_google_login_new_user(client: AsyncClient, db_session: AsyncSession):
    from unittest.mock import patch
    from app.core.config import settings

    aud_val = settings.GOOGLE_CLIENT_ID or "test-client-id"

    class MockResponse:
        def __init__(self, json_data, status_code):
            self._json = json_data
            self.status_code = status_code
        def json(self):
            return self._json

    async def mock_get(url, *args, **kwargs):
        if "tokeninfo" in url:
            return MockResponse({"email": "google_test@company.com", "email_verified": "true", "aud": aud_val}, 200)
        elif "userinfo" in url:
            return MockResponse({"email": "google_test@company.com", "name": "Google Test User"}, 200)
        return MockResponse({}, 404)

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        payload = {"token": "mock-valid-google-token"}
        response = await client.post("/api/v1/auth/google", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "google_test@company.com"
        assert data["user"]["role"] == "ORG_ADMIN"

        # Verify database record
        stmt = select(User).where(User.email == "google_test@company.com")
        db_res = await db_session.execute(stmt)
        db_user = db_res.scalar_one_or_none()
        assert db_user is not None
        assert db_user.full_name == "Google Test User"


@pytest.mark.asyncio
async def test_google_login_existing_user(client: AsyncClient, db_session: AsyncSession):
    from unittest.mock import patch
    from app.core.config import settings

    aud_val = settings.GOOGLE_CLIENT_ID or "test-client-id"

    # Register the user first with email login
    reg_payload = {
        "email": "existing_google@company.com",
        "password": "Secure_pass_123",
        "full_name": "Existing User",
        "organization_name": "Existing Inc."
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    class MockResponse:
        def __init__(self, json_data, status_code):
            self._json = json_data
            self.status_code = status_code
        def json(self):
            return self._json

    async def mock_get(url, *args, **kwargs):
        if "tokeninfo" in url:
            return MockResponse({"email": "existing_google@company.com", "email_verified": "true", "aud": aud_val}, 200)
        elif "userinfo" in url:
            return MockResponse({"email": "existing_google@company.com", "name": "Existing User"}, 200)
        return MockResponse({}, 404)

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        payload = {"token": "mock-valid-google-token"}
        response = await client.post("/api/v1/auth/google", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "existing_google@company.com"
