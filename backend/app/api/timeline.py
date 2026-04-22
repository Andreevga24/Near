"""
Таймлайн задачи: объединённая лента комментариев и событий активности.
"""

from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_task_or_404
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.comment import Comment
from app.models.task_activity import TaskActivity
from app.models.user import User
from app.schemas.timeline import TimelineEventRead


router = APIRouter(prefix="/timeline", tags=["timeline"])


def _safe_json(text: str) -> dict:
    try:
        v = json.loads(text or "{}")
        return v if isinstance(v, dict) else {"value": v}
    except Exception:
        return {"raw": text}


@router.get("", response_model=list[TimelineEventRead])
async def list_task_timeline(
    task_id: UUID = Query(..., description="Идентификатор задачи"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[TimelineEventRead]:
    task = await get_owned_task_or_404(session, user, task_id)

    # активности (снимки), newest first
    r1 = await session.execute(
        select(TaskActivity, User.email)
        .outerjoin(User, TaskActivity.actor_id == User.id)
        .where(TaskActivity.task_id == task.id)
        .order_by(TaskActivity.created_at.desc()),
    )
    activities = [
        TimelineEventRead(
            id=a.id,
            task_id=a.task_id,
            type=a.type,
            created_at=a.created_at,
            actor_id=a.actor_id,
            actor_email=email,
            data=_safe_json(a.data),
        )
        for (a, email) in r1.all()
    ]

    # комментарии как часть таймлайна (не логируем создание как activity — чтобы не было дублей)
    r2 = await session.execute(
        select(Comment, User.email)
        .outerjoin(User, Comment.author_id == User.id)
        .where(Comment.task_id == task.id)
        .order_by(Comment.created_at.desc()),
    )
    comments = [
        TimelineEventRead(
            id=c.id,
            task_id=c.task_id,
            type="comment_created",
            created_at=c.created_at,
            actor_id=c.author_id,
            actor_email=email,
            data={"body": c.body},
        )
        for (c, email) in r2.all()
    ]

    merged = [*activities, *comments]
    merged.sort(key=lambda e: e.created_at, reverse=True)
    return merged

