"""
Доступ к каналам мессенджера.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import list_accessible_project_ids, user_can_access_project
from app.models.chat_channel import ChatChannel
from app.models.task import Task
from app.models.user import User


async def user_can_access_channel(session: AsyncSession, user: User, channel: ChatChannel) -> bool:
    if channel.project_id is not None:
        return await user_can_access_project(session, user, channel.project_id)
    if channel.task_id is not None:
        task = await session.get(Task, channel.task_id)
        if task is None:
            return False
        return await user_can_access_project(session, user, task.project_id)
    return channel.created_by_user_id == user.id


async def get_channel_or_404(session: AsyncSession, user: User, channel_id: UUID) -> ChatChannel:
    channel = await session.get(ChatChannel, channel_id)
    if channel is None or not await user_can_access_channel(session, user, channel):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Канал не найден")
    return channel


async def list_accessible_channels(session: AsyncSession, user: User) -> list[ChatChannel]:
    accessible = await list_accessible_project_ids(session, user)
    conditions = [ChatChannel.created_by_user_id == user.id]
    if accessible:
        conditions.append(ChatChannel.project_id.in_(accessible))
        task_ids_res = await session.execute(
            select(Task.id).where(Task.project_id.in_(accessible)),
        )
        task_ids = [row[0] for row in task_ids_res.all()]
        if task_ids:
            conditions.append(ChatChannel.task_id.in_(task_ids))
    res = await session.execute(
        select(ChatChannel).where(or_(*conditions)).order_by(ChatChannel.created_at.asc()),
    )
    return list(res.scalars().all())
