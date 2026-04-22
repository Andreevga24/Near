"""
Режим фокуса: подобрать «следующую» задачу по правилам.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_project_or_404
from app.auth.manager import current_active_user
from app.constants.board_presets import preset_for_kind
from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskRead


router = APIRouter(prefix="/focus", tags=["focus"])


def _terminal_statuses(kind: str | None) -> set[str]:
    preset = preset_for_kind(kind)
    if not preset:
        return set()
    # Для CRM две терминальные колонки: won + lost.
    if kind == "crm_sales" and len(preset) >= 2:
        return {preset[-1], preset[-2]}
    return {preset[-1]}


@router.get("/next", response_model=TaskRead)
async def next_focus_task(
    project_id: UUID = Query(..., description="Идентификатор проекта"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task | Response:
    """
    Вернуть одну «следующую» задачу.

    Правила сортировки (в порядке важности):
    - дедлайн (due_at): ближайший раньше
    - приоритет (priority): больше — важнее
    - колонка: раньше по пресету project.kind
    - давность: более старая раньше
    - position: стабильная подстройка внутри колонки
    """
    project: Project = await get_owned_project_or_404(session, user, project_id)
    preset = preset_for_kind(project.kind)
    col_index = {s: i for i, s in enumerate(preset)}
    terminals = _terminal_statuses(project.kind)

    result = await session.execute(select(Task).where(Task.project_id == project_id))
    tasks = list(result.scalars().all())

    # фильтруем терминальные статусы
    candidates = [t for t in tasks if t.status not in terminals]
    if not candidates:
        # 204 no content лучше, чем 404 — проект существует, но задач «в фокусе» нет
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    def col_rank(status_: str) -> int:
        return col_index.get(status_, 10_000)

    def due_rank(t: Task):
        if t.due_at is None:
            return (1, datetime.max.replace(tzinfo=timezone.utc))
        # если в БД naive datetime (SQLite), считаем UTC
        d = t.due_at
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return (0, d)

    def key(t: Task):
        due_flag, due_dt = due_rank(t)
        created = t.created_at
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        return (
            due_flag,
            due_dt,
            -int(t.priority or 0),
            col_rank(t.status),
            created,
            int(t.position or 0),
        )

    candidates.sort(key=key)
    return candidates[0]

