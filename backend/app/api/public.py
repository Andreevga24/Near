"""
Публичный read-only доступ к доске по share_id.
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.task_link import TaskLink
from app.schemas.public import PublicProjectBoardRead, PublicProjectRead
from app.schemas.task import TaskRead
from app.schemas.task_link import TaskLinkRead

router = APIRouter(prefix="/public", tags=["public"])


def _parse_hidden_columns(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        v = json.loads(raw)
        if isinstance(v, list):
            return [str(x) for x in v if isinstance(x, str) and x.strip()]
    except json.JSONDecodeError:
        pass
    return []


@router.get("/{share_id}", response_model=PublicProjectBoardRead)
async def read_public_project_board(
    share_id: str,
    session: AsyncSession = Depends(get_async_session),
) -> PublicProjectBoardRead:
    if not share_id or len(share_id) > 128:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Не найдено")

    res = await session.execute(
        select(Project).where(Project.share_id == share_id, Project.is_public.is_(True)),
    )
    project = res.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Не найдено")

    if project.share_expires_at is not None:
        expires = project.share_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Срок ссылки истёк")

    hidden = _parse_hidden_columns(project.public_hidden_columns)

    t_res = await session.execute(
        select(Task)
        .where(Task.project_id == project.id, Task.closed_at.is_(None))
        .order_by(Task.status.asc(), Task.position.asc(), Task.created_at.asc()),
    )
    l_res = await session.execute(
        select(TaskLink)
        .where(TaskLink.project_id == project.id)
        .order_by(TaskLink.type.asc(), TaskLink.created_at.asc()),
    )

    tasks = [TaskRead.model_validate(t) for t in list(t_res.scalars().all())]
    if hidden:
        hidden_set = set(hidden)
        tasks = [t for t in tasks if t.status not in hidden_set]

    return PublicProjectBoardRead(
        project=PublicProjectRead.model_validate(project),
        tasks=tasks,
        links=[TaskLinkRead.model_validate(l) for l in list(l_res.scalars().all())],
        hidden_columns=hidden,
        watermark="Near",
    )
