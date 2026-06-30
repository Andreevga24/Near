"""Fixtures for Near API integration tests."""

from __future__ import annotations

import os
import uuid
from pathlib import Path

_TEST_DB = Path(__file__).resolve().parent.parent / "test_integration.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TEST_DB.as_posix()}"
os.environ["JWT_SECRET"] = "test-jwt-secret-ci-only"
os.environ["RATE_LIMIT_ENABLED"] = "false"
if _TEST_DB.exists():
    _TEST_DB.unlink()

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import engine
from app.legal.constants import PRIVACY_VERSION, TERMS_VERSION


def _register_payload(email: str, password: str) -> dict:
    return {
        "email": email,
        "password": password,
        "accept_privacy": True,
        "accept_terms": True,
        "privacy_version": PRIVACY_VERSION,
        "terms_version": TERMS_VERSION,
    }


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()
    if _TEST_DB.exists():
        _TEST_DB.unlink()


@pytest_asyncio.fixture
async def client():
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    password = "TestPass123!"
    reg = await client.post("/register", json=_register_payload(email, password))
    assert reg.status_code in (200, 201), reg.text
    login = await client.post(
        "/login",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def project(client: AsyncClient, auth_headers: dict[str, str]) -> dict:
    resp = await client.post(
        "/projects",
        headers=auth_headers,
        json={"name": "Test project", "description": "", "kind": "general"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()
