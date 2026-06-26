"""
Глобальная лента событий по доступным проектам.
"""

from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import list_accessible_project_ids
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.comment import Comment
from app.models.project import Project
from app.models.task import Task
from app.models.task_activity import TaskActivity
from app.models.user import User
from app.schemas.feed import FeedItemRead, FeedRead
from app.services.notifications import _activity_summary

router = APIRouter(prefix="/feed", tags=["feed"])


def _safe_json(text: str) -> dict[str, object]:
    try:
        v = json.loads(text or "{}")
        return v if isinstance(v, dict) else {"value": v}
    except json.JSONDecodeError:
        return {"raw": text}


@router.get("", response_model=FeedRead)
async def list_feed(
    project_id: UUID | None = Query(None),
    limit: int = Query(100, ge=1, le=300),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> FeedRead:
    accessible = await list_accessible_project_ids(session, user)
    if project_id is not None:
        if project_id not in accessible:
            accessible = []
        else:
            accessible = [project_id]
    if not accessible:
        return FeedRead(items=[])

    items: list[FeedItemRead] = []

    act_res = await session.execute(
        select(TaskActivity, Task, Project, User.email)
        .join(Task, TaskActivity.task_id == Task.id)
        .join(Project, Task.project_id == Project.id)
        .outerjoin(User, TaskActivity.actor_id == User.id)
        .where(Task.project_id.in_(accessible))
        .order_by(TaskActivity.created_at.desc())
        .limit(limit),
    )
    for activity, task, project, actor_email in act_res.all():
        data = _safe_json(activity.data)
        items.append(
            FeedItemRead(
                id=f"activity-{activity.id}",
                type=activity.type,
                created_at=activity.created_at,
                project_id=project.id,
                project_name=project.name,
                task_id=task.id,
                task_title=task.title,
                actor_id=activity.actor_id,
                actor_email=actor_email,
                summary=_activity_summary(activity.type, data, task.title),
                data=data,
                href=f"/projects/{project.id}",
            ),
        )

    comm_res = await session.execute(
        select(Comment, Task, Project, User.email)
        .join(Task, Comment.task_id == Task.id)
        .join(Project, Task.project_id == Project.id)
        .outerjoin(User, Comment.author_id == User.id)
        .where(Task.project_id.in_(accessible))
        .order_by(Comment.created_at.desc())
        .limit(limit),
    )
    for comment, task, project, actor_email in comm_res.all():
        data: dict[str, object] = {"body": comment.body}
        items.append(
            FeedItemRead(
                id=f"comment-{comment.id}",
                type="comment_created",
                created_at=comment.created_at,
                project_id=project.id,
                project_name=project.name,
                task_id=task.id,
                task_title=task.title,
                actor_id=comment.author_id,
                actor_email=actor_email,
                summary=_activity_summary("comment_created", data, task.title),
                data=data,
                href=f"/projects/{project.id}",
            ),
        )

    items.sort(key=lambda x: x.created_at, reverse=True)
    return FeedRead(items=items[:limit])
