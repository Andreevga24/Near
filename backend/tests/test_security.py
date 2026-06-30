"""Тесты безопасности: rate limit, публичная доска."""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.core.config import settings
from app.legal.constants import PRIVACY_VERSION, TERMS_VERSION
from app.security import middleware as security_middleware


@pytest.mark.asyncio
async def test_public_board_hides_assignee(client: AsyncClient, auth_headers: dict[str, str], project: dict) -> None:
    pid = project["id"]
    await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "Shared", "status": "todo"},
    )
    enable = await client.put(f"/projects/{pid}/share/enable", headers=auth_headers, json={})
    assert enable.status_code == 200
    share_id = enable.json()["share_id"]

    public = await client.get(f"/public/{share_id}")
    assert public.status_code == 200
    body = public.json()
    assert len(body["tasks"]) == 1
    task = body["tasks"][0]
    assert "assignee_id" not in task
    assert "project_id" not in task


@pytest.mark.asyncio
async def test_register_rate_limit(client: AsyncClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """После лимита регистраций с одного IP — 429."""
    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", True)
    security_middleware._hits.clear()

    last_status = 201
    for i in range(6):
        email = f"ratelimit_{uuid.uuid4().hex[:8]}_{i}@example.com"
        resp = await client.post(
            "/register",
            json={
                "email": email,
                "password": "TestPass123!",
                "accept_privacy": True,
                "accept_terms": True,
                "privacy_version": PRIVACY_VERSION,
                "terms_version": TERMS_VERSION,
            },
        )
        last_status = resp.status_code
    assert last_status == 429

    monkeypatch.setattr(settings, "RATE_LIMIT_ENABLED", False)
    security_middleware._hits.clear()
