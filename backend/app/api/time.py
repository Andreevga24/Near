"""Тайм-трекинг: старт/стоп, отчёт по проекту."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_task_or_404, list_accessible_project_ids
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.task import Task
from app.models.task_time_entry import TaskTimeEntry
from app.models.user import User
from app.schemas.time import TimeByTask, TimeByUser, TimeEntryRead, TimeReportRead, TimeStart

router = APIRouter(prefix="/time", tags=["time"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _duration_seconds(started: datetime, stopped: datetime | None) -> int | None:
    if stopped is None:
        return None
    return max(0, int((_aware(stopped) - _aware(started)).total_seconds()))


def _entry_read(entry: TaskTimeEntry, task_title: str | None = None) -> TimeEntryRead:
    return TimeEntryRead(
        id=entry.id,
        task_id=entry.task_id,
        user_id=entry.user_id,
        started_at=entry.started_at,
        stopped_at=entry.stopped_at,
        duration_seconds=_duration_seconds(entry.started_at, entry.stopped_at),
        task_title=task_title,
    )


async def _stop_running(session: AsyncSession, user_id: UUID) -> TaskTimeEntry | None:
    result = await session.execute(
        select(TaskTimeEntry).where(
            TaskTimeEntry.user_id == user_id,
            TaskTimeEntry.stopped_at.is_(None),
        ),
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None
    entry.stopped_at = _now()
    return entry


@router.post("/start", response_model=TimeEntryRead, status_code=status.HTTP_201_CREATED)
async def start_timer(
    body: TimeStart,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TimeEntryRead:
    task = await get_owned_task_or_404(session, user, body.task_id)
    await _stop_running(session, user.id)
    entry = TaskTimeEntry(task_id=task.id, user_id=user.id, started_at=_now())
    session.add(entry)
    await session.commit()
    await session.refresh(entry)
    return _entry_read(entry, task.title)


@router.post("/stop", response_model=TimeEntryRead)
async def stop_timer(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TimeEntryRead:
    entry = await _stop_running(session, user.id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Нет активного таймера")
    task_res = await session.execute(select(Task.title).where(Task.id == entry.task_id))
    title = task_res.scalar_one_or_none()
    await session.commit()
    await session.refresh(entry)
    return _entry_read(entry, title)


@router.get("/active", response_model=TimeEntryRead | None)
async def active_timer(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TimeEntryRead | None:
    result = await session.execute(
        select(TaskTimeEntry, Task.title)
        .join(Task, Task.id == TaskTimeEntry.task_id)
        .where(
            TaskTimeEntry.user_id == user.id,
            TaskTimeEntry.stopped_at.is_(None),
        ),
    )
    row = result.first()
    if row is None:
        return None
    entry, title = row
    return _entry_read(entry, title)


@router.get("/report", response_model=TimeReportRead)
async def time_report(
    project_id: UUID | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TimeReportRead:
    accessible = await list_accessible_project_ids(session, user)
    if not accessible:
        return TimeReportRead()

    if project_id is not None:
        if project_id not in accessible:
            return TimeReportRead(project_id=project_id)
        project_ids = [project_id]
    else:
        project_ids = accessible

    since = _now() - timedelta(days=days)
    result = await session.execute(
        select(TaskTimeEntry, Task, User.email)
        .join(Task, Task.id == TaskTimeEntry.task_id)
        .join(User, User.id == TaskTimeEntry.user_id)
        .where(
            Task.project_id.in_(project_ids),
            TaskTimeEntry.started_at >= since,
        )
        .order_by(TaskTimeEntry.started_at.desc()),
    )
    rows = result.all()

    total = 0
    by_task: dict[UUID, tuple[str, int]] = {}
    by_user: dict[UUID, tuple[str, int]] = {}
    entries: list[TimeEntryRead] = []

    for entry, task, email in rows:
        dur = _duration_seconds(entry.started_at, entry.stopped_at)
        if dur is None:
            dur = max(0, int((_now() - _aware(entry.started_at)).total_seconds()))
        total += dur

        t_title, t_sec = by_task.get(task.id, (task.title, 0))
        by_task[task.id] = (t_title, t_sec + dur)

        u_email, u_sec = by_user.get(entry.user_id, (email, 0))
        by_user[entry.user_id] = (u_email, u_sec + dur)

        entries.append(_entry_read(entry, task.title))

    return TimeReportRead(
        project_id=project_id,
        total_seconds=total,
        by_task=[
            TimeByTask(task_id=tid, task_title=title, total_seconds=sec)
            for tid, (title, sec) in sorted(by_task.items(), key=lambda x: -x[1][1])
        ],
        by_user=[
            TimeByUser(user_id=uid, user_email=email, total_seconds=sec)
            for uid, (email, sec) in sorted(by_user.items(), key=lambda x: -x[1][1])
        ],
        entries=entries,
    )
