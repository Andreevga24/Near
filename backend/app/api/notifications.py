"""
Центр уведомлений пользователя.
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.user import User
from app.models.user_notification import UserNotification
from app.schemas.notification import NotificationListRead, NotificationMarkRead, NotificationRead
from app.services.notifications import ensure_due_reminders

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListRead)
async def list_notifications(
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> NotificationListRead:
    await ensure_due_reminders(session, user)
    unread_res = await session.execute(
        select(func.count(UserNotification.id)).where(
            UserNotification.user_id == user.id,
            UserNotification.read_at.is_(None),
        ),
    )
    unread = int(unread_res.scalar_one() or 0)
    res = await session.execute(
        select(UserNotification)
        .where(UserNotification.user_id == user.id)
        .order_by(UserNotification.created_at.desc())
        .limit(limit),
    )
    items = [NotificationRead.model_validate(n) for n in res.scalars().all()]
    return NotificationListRead(items=items, unread_count=unread)


@router.get("/unread-count")
async def unread_count(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> dict[str, int]:
    await ensure_due_reminders(session, user)
    res = await session.execute(
        select(func.count(UserNotification.id)).where(
            UserNotification.user_id == user.id,
            UserNotification.read_at.is_(None),
        ),
    )
    return {"count": int(res.scalar_one() or 0)}


@router.post("/mark-read", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def mark_read(
    payload: NotificationMarkRead,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    if not payload.ids:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    now = datetime.now(timezone.utc)
    await session.execute(
        update(UserNotification)
        .where(
            UserNotification.user_id == user.id,
            UserNotification.id.in_(payload.ids),
            UserNotification.read_at.is_(None),
        )
        .values(read_at=now),
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/mark-all-read", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def mark_all_read(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    now = datetime.now(timezone.utc)
    await session.execute(
        update(UserNotification)
        .where(
            UserNotification.user_id == user.id,
            UserNotification.read_at.is_(None),
        )
        .values(read_at=now),
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
