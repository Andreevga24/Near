"""Диаграмма Ганта: задачи по срокам и зависимости blocks."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends
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
from app.schemas.gantt import GanttLinkRead, GanttRead, GanttTaskRead

router = APIRouter(prefix="/projects", tags=["gantt"])


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _terminal_statuses(kind: str | None) -> set[str]:
    preset = preset_for_kind(kind)
    if not preset:
        return set()
    if kind == "crm_sales" and len(preset) >= 2:
        return {preset[-1], preset[-2]}
    return {preset[-1]}


@router.get("/{project_id}/gantt", response_model=GanttRead)
async def project_gantt(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> GanttRead:
    project: Project = await get_readable_project_or_404(session, user, project_id)
    terminals = _terminal_statuses(project.kind)

    tasks_res = await session.execute(
        select(Task).where(Task.project_id == project_id, Task.closed_at.is_(None)),
    )
    tasks = list(tasks_res.scalars().all())

    links_res = await session.execute(
        select(TaskLink).where(TaskLink.project_id == project_id, TaskLink.type == "blocks"),
    )
    links = list(links_res.scalars().all())
    blocked_by: dict[UUID, list[UUID]] = {}
    for link in links:
        blocked_by.setdefault(link.to_task_id, []).append(link.from_task_id)

    now = datetime.now(timezone.utc)
    gantt_tasks: list[GanttTaskRead] = []
    range_start = now
    range_end = now + timedelta(days=7)

    for task in tasks:
        start = _aware(task.created_at)
        if task.due_at is not None:
            end = _aware(task.due_at)
            if end < start:
                end = start + timedelta(days=1)
        elif task.status in terminals:
            end = start + timedelta(days=1)
        else:
            end = start + timedelta(days=7)

        if start < range_start:
            range_start = start
        if end > range_end:
            range_end = end

        gantt_tasks.append(
            GanttTaskRead(
                id=task.id,
                title=task.title,
                status=task.status,
                assignee_id=task.assignee_id,
                start_at=start,
                end_at=end,
                blocked_by=blocked_by.get(task.id, []),
            ),
        )

    if not gantt_tasks:
        range_start = now - timedelta(days=1)
        range_end = now + timedelta(days=14)

    return GanttRead(
        project_id=project.id,
        project_name=project.name,
        range_start=range_start,
        range_end=range_end,
        tasks=sorted(gantt_tasks, key=lambda t: (t.start_at, t.title)),
        links=[
            GanttLinkRead(from_task_id=l.from_task_id, to_task_id=l.to_task_id, type=l.type)
            for l in links
        ],
    )
