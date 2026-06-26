"""
Режим фокуса: подобрать «следующую» задачу по правилам.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_readable_project_or_404
from app.auth.manager import current_active_user
from app.constants.board_presets import preset_for_kind
from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.task_link import TaskLink
from app.models.user import User
from app.schemas.task import TaskRead

router = APIRouter(prefix="/focus", tags=["focus"])


def _terminal_statuses(kind: str | None) -> set[str]:
    preset = preset_for_kind(kind)
    if not preset:
        return set()
    if kind == "crm_sales" and len(preset) >= 2:
        return {preset[-1], preset[-2]}
    return {preset[-1]}


def _blocked_task_ids(
    tasks: list[Task],
    links: list[TaskLink],
    terminals: set[str],
) -> set[UUID]:
    """Задачи, заблокированные незавершёнными blocks-связями."""
    active_by_id = {t.id: t for t in tasks if t.closed_at is None}
    blocked: set[UUID] = set()
    for link in links:
        if link.type != "blocks":
            continue
        blocker = active_by_id.get(link.from_task_id)
        if blocker is None or blocker.status in terminals:
            continue
        if link.to_task_id in active_by_id:
            blocked.add(link.to_task_id)
    return blocked


@router.get(
    "/next",
    response_model=None,
    responses={
        200: {"model": TaskRead},
        204: {"description": "Нет задач для режима фокуса"},
    },
)
async def next_focus_task(
    project_id: UUID = Query(..., description="Идентификатор проекта"),
    due_weight: float = Query(default=3.0, ge=0.0, le=100.0),
    priority_weight: float = Query(default=2.0, ge=0.0, le=100.0),
    column_weight: float = Query(default=1.0, ge=0.0, le=100.0),
    exclude_blocked: bool = Query(default=True),
    skip: str | None = Query(default=None, description="UUID задач через запятую (отложить)"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task | Response:
    project: Project = await get_readable_project_or_404(session, user, project_id)
    preset = preset_for_kind(project.kind)
    col_index = {s: i for i, s in enumerate(preset)}
    terminals = _terminal_statuses(project.kind)

    skip_ids: set[UUID] = set()
    if skip:
        for part in skip.split(","):
            part = part.strip()
            if not part:
                continue
            try:
                skip_ids.add(UUID(part))
            except ValueError:
                continue

    result = await session.execute(select(Task).where(Task.project_id == project_id, Task.closed_at.is_(None)))
    tasks = list(result.scalars().all())

    links_res = await session.execute(select(TaskLink).where(TaskLink.project_id == project_id, TaskLink.type == "blocks"))
    links = list(links_res.scalars().all())
    blocked = _blocked_task_ids(tasks, links, terminals) if exclude_blocked else set()

    candidates = [
        t
        for t in tasks
        if t.status not in terminals and t.id not in skip_ids and t.id not in blocked
    ]
    if not candidates:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    def col_rank(status_: str) -> int:
        return col_index.get(status_, 10_000)

    def due_rank(t: Task) -> tuple[int, float]:
        if t.due_at is None:
            return (1, float("inf"))
        d = t.due_at
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (0, d.timestamp())

    def key(t: Task) -> tuple[float, float, float, float, float]:
        due_flag, due_ts = due_rank(t)
        created = t.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (
            due_weight * float(due_flag),
            due_weight * due_ts,
            -priority_weight * float(t.priority or 0),
            column_weight * float(col_rank(t.status)),
            created.timestamp(),
            float(t.position or 0),
        )

    candidates.sort(key=key)
    return candidates[0]
