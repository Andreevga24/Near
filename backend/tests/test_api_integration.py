"""Integration tests for core REST flows: tasks, archive, focus, public share."""

from __future__ import annotations

import uuid

from httpx import AsyncClient
import pytest

from app.legal.constants import PRIVACY_VERSION, TERMS_VERSION


@pytest.mark.asyncio
async def test_register_requires_consent(client: AsyncClient) -> None:
    email = f"noconsent_{uuid.uuid4().hex[:10]}@example.com"
    resp = await client.post(
        "/register",
        json={"email": email, "password": "TestPass123!"},
    )
    assert resp.status_code == 422

    resp2 = await client.post(
        "/register",
        json={
            "email": email,
            "password": "TestPass123!",
            "accept_privacy": False,
            "accept_terms": True,
            "privacy_version": PRIVACY_VERSION,
            "terms_version": TERMS_VERSION,
        },
    )
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_legal_meta(client: AsyncClient) -> None:
    resp = await client.get("/legal/meta")
    assert resp.status_code == 200
    body = resp.json()
    assert body["privacy_version"] == PRIVACY_VERSION
    assert body["terms_version"] == TERMS_VERSION
    assert "operator_name" in body


@pytest.mark.asyncio
async def test_tasks_crud(client: AsyncClient, auth_headers: dict[str, str], project: dict) -> None:
    pid = project["id"]
    create = await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "First task", "status": "todo"},
    )
    assert create.status_code == 201, create.text
    task = create.json()
    assert task["title"] == "First task"
    assert task["closed_at"] is None

    listing = await client.get("/tasks", headers=auth_headers, params={"project_id": pid})
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    update = await client.put(
        f"/tasks/{task['id']}",
        headers=auth_headers,
        json={"title": "Updated task", "priority": 5},
    )
    assert update.status_code == 200
    assert update.json()["title"] == "Updated task"
    assert update.json()["priority"] == 5

    delete = await client.delete(f"/tasks/{task['id']}", headers=auth_headers)
    assert delete.status_code == 204

    after = await client.get("/tasks", headers=auth_headers, params={"project_id": pid})
    assert after.json() == []


@pytest.mark.asyncio
async def test_archive_close_and_restore(
    client: AsyncClient,
    auth_headers: dict[str, str],
    project: dict,
) -> None:
    pid = project["id"]
    create = await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "To archive", "status": "todo"},
    )
    assert create.status_code == 201
    task_id = create.json()["id"]

    close = await client.post(
        f"/tasks/{task_id}/close",
        headers=auth_headers,
        json={"completed": True},
    )
    assert close.status_code == 200
    closed = close.json()
    assert closed["closed_at"] is not None
    assert closed["completed"] is True

    active = await client.get("/tasks", headers=auth_headers, params={"project_id": pid})
    assert active.json() == []

    archived = await client.get("/tasks/archived", headers=auth_headers, params={"project_id": pid})
    assert archived.status_code == 200
    body = archived.json()
    assert body["retention_days"] >= 1
    assert len(body["tasks"]) == 1
    assert body["tasks"][0]["id"] == task_id

    restore = await client.post(f"/tasks/{task_id}/restore", headers=auth_headers)
    assert restore.status_code == 200
    restored = restore.json()
    assert restored["closed_at"] is None

    active_again = await client.get("/tasks", headers=auth_headers, params={"project_id": pid})
    assert len(active_again.json()) == 1


@pytest.mark.asyncio
async def test_focus_next_prefers_higher_priority(
    client: AsyncClient,
    auth_headers: dict[str, str],
    project: dict,
) -> None:
    pid = project["id"]
    low = await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "Low", "status": "todo", "priority": 1},
    )
    high = await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "High", "status": "todo", "priority": 9},
    )
    assert low.status_code == 201 and high.status_code == 201

    focus = await client.get("/focus/next", headers=auth_headers, params={"project_id": pid})
    assert focus.status_code == 200
    assert focus.json()["id"] == high.json()["id"]
    assert focus.json()["priority"] == 9


@pytest.mark.asyncio
async def test_public_share_enable_read_disable(
    client: AsyncClient,
    auth_headers: dict[str, str],
    project: dict,
) -> None:
    pid = project["id"]
    await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "Public task", "status": "todo"},
    )

    enable = await client.put(f"/projects/{pid}/share/enable", headers=auth_headers, json={})
    assert enable.status_code == 200
    share = enable.json()
    assert share["enabled"] is True
    assert share["share_id"]
    share_id = share["share_id"]

    public = await client.get(f"/public/{share_id}")
    assert public.status_code == 200
    board = public.json()
    assert board["project"]["id"] == pid
    assert len(board["tasks"]) == 1
    assert board["tasks"][0]["title"] == "Public task"

    disable = await client.put(f"/projects/{pid}/share/disable", headers=auth_headers)
    assert disable.status_code == 200
    assert disable.json()["enabled"] is False

    gone = await client.get(f"/public/{share_id}")
    assert gone.status_code == 404


@pytest.mark.asyncio
async def test_time_start_and_stop(
    client: AsyncClient,
    auth_headers: dict[str, str],
    project: dict,
) -> None:
    pid = project["id"]
    create = await client.post(
        "/tasks",
        headers=auth_headers,
        json={"project_id": pid, "title": "Timed task", "status": "todo"},
    )
    assert create.status_code == 201
    task_id = create.json()["id"]

    start = await client.post("/time/start", headers=auth_headers, json={"task_id": task_id})
    assert start.status_code == 201
    assert start.json()["stopped_at"] is None

    stop = await client.post("/time/stop", headers=auth_headers)
    assert stop.status_code == 200
    assert stop.json()["stopped_at"] is not None

    report = await client.get("/time/report", headers=auth_headers, params={"project_id": pid})
    assert report.status_code == 200
    assert report.json()["total_seconds"] >= 0

