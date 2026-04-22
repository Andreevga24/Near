"""
Комментарии к задачам + простые @упоминания.
"""

from __future__ import annotations

import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_task_or_404
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.comment import Comment
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentRead
from app.services.timeline import add_activity

router = APIRouter(prefix="/comments", tags=["comments"])

# Очень простой формат: @email. Не пытаемся поддерживать пробелы/юзернеймы.
MENTION_RE = re.compile(r"@([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})", re.IGNORECASE)


def extract_mentions(text: str) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for m in MENTION_RE.findall(text or ""):
        key = m.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(m)
    return out


def to_read(c: Comment, author_email: str | None) -> CommentRead:
    return CommentRead(
        id=c.id,
        task_id=c.task_id,
        author_id=c.author_id,
        author_email=author_email,
        body=c.body,
        created_at=c.created_at,
        mentions=extract_mentions(c.body),
    )


@router.get("", response_model=list[CommentRead])
async def list_comments(
    task_id: UUID = Query(..., description="Идентификатор задачи"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[CommentRead]:
    task = await get_owned_task_or_404(session, user, task_id)
    result = await session.execute(
        select(Comment, User.email)
        .outerjoin(User, Comment.author_id == User.id)
        .where(Comment.task_id == task.id)
        .order_by(Comment.created_at.asc()),
    )
    rows = result.all()
    return [to_read(c, email) for (c, email) in rows]


@router.post("", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
async def create_comment(
    payload: CommentCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> CommentRead:
    await get_owned_task_or_404(session, user, payload.task_id)
    c = Comment(task_id=payload.task_id, author_id=user.id, body=payload.body)
    session.add(c)
    await session.commit()
    await session.refresh(c)
    # комментарии показываются в таймлайне напрямую, поэтому activity не пишем, чтобы не дублировать
    return to_read(c, user.email)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_comment(
    comment_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    result = await session.execute(select(Comment).where(Comment.id == comment_id))
    c = result.scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    # проверка доступа через задачу
    await get_owned_task_or_404(session, user, c.task_id)
    await add_activity(
        session,
        task_id=c.task_id,
        actor_id=user.id,
        type="comment_deleted",
        data={"comment_id": str(c.id), "body": c.body},
    )
    await session.execute(delete(Comment).where(Comment.id == comment_id))
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

