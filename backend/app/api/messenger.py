"""
Каналы и сообщения мессенджера.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_editable_project_or_404, get_readable_project_or_404, get_task_or_404
from app.api.messenger_access import get_channel_or_404, list_accessible_channels
from app.auth.manager import current_active_user
from app.constants.project_roles import ProjectRole
from app.db.session import get_async_session
from app.models.chat_channel import ChatChannel
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.schemas.messenger import ChatChannelCreate, ChatChannelRead, ChatMessageCreate, ChatMessageRead
from app.ws.hub import chat_ws_hub

router = APIRouter(prefix="/messenger", tags=["messenger"])


def _channel_to_read(channel: ChatChannel, message_count: int = 0) -> ChatChannelRead:
    return ChatChannelRead(
        id=channel.id,
        title=channel.title,
        project_id=channel.project_id,
        task_id=channel.task_id,
        created_by_user_id=channel.created_by_user_id,
        created_at=channel.created_at,
        message_count=message_count,
    )


@router.get("/channels", response_model=list[ChatChannelRead])
async def list_channels(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[ChatChannelRead]:
    channels = await list_accessible_channels(session, user)
    if not channels:
        return []
    ids = [c.id for c in channels]
    counts_res = await session.execute(
        select(ChatMessage.channel_id, func.count(ChatMessage.id))
        .where(ChatMessage.channel_id.in_(ids))
        .group_by(ChatMessage.channel_id),
    )
    counts = {cid: int(cnt) for cid, cnt in counts_res.all()}
    return [_channel_to_read(c, counts.get(c.id, 0)) for c in channels]


@router.post("/channels", response_model=ChatChannelRead, status_code=status.HTTP_201_CREATED)
async def create_channel(
    payload: ChatChannelCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ChatChannelRead:
    title = payload.title.strip()
    if payload.project_id and payload.task_id:
        raise HTTPException(status_code=400, detail="Укажите project_id или task_id, не оба")
    project_id = payload.project_id
    task_id = payload.task_id
    if task_id is not None:
        task = await get_task_or_404(session, user, task_id, ProjectRole.EDITOR)
        project_id = task.project_id
    elif project_id is not None:
        await get_editable_project_or_404(session, user, project_id)
    channel = ChatChannel(
        created_by_user_id=user.id,
        project_id=project_id,
        task_id=task_id,
        title=title,
    )
    session.add(channel)
    await session.commit()
    await session.refresh(channel)
    return _channel_to_read(channel)


@router.get("/channels/{channel_id}/messages", response_model=list[ChatMessageRead])
async def list_messages(
    channel_id: UUID,
    limit: int = Query(default=200, ge=1, le=500),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[ChatMessageRead]:
    channel = await get_channel_or_404(session, user, channel_id)
    res = await session.execute(
        select(ChatMessage, User.email)
        .join(User, ChatMessage.user_id == User.id)
        .where(ChatMessage.channel_id == channel.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit),
    )
    rows = list(res.all())
    rows.reverse()
    return [
        ChatMessageRead(
            id=msg.id,
            channel_id=msg.channel_id,
            user_id=msg.user_id,
            author_email=email,
            text=msg.text,
            created_at=msg.created_at,
        )
        for msg, email in rows
    ]


@router.post("/channels/{channel_id}/messages", response_model=ChatMessageRead, status_code=status.HTTP_201_CREATED)
async def post_message(
    channel_id: UUID,
    payload: ChatMessageCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ChatMessageRead:
    channel = await get_channel_or_404(session, user, channel_id)
    if channel.project_id is not None:
        await get_readable_project_or_404(session, user, channel.project_id)
    elif channel.task_id is not None:
        await get_task_or_404(session, user, channel.task_id, ProjectRole.VIEWER)
    msg = ChatMessage(channel_id=channel.id, user_id=user.id, text=payload.text.strip())
    session.add(msg)
    await session.commit()
    await session.refresh(msg)
    read = ChatMessageRead(
        id=msg.id,
        channel_id=msg.channel_id,
        user_id=msg.user_id,
        author_email=user.email,
        text=msg.text,
        created_at=msg.created_at,
    )
    await chat_ws_hub.broadcast_json(
        channel.id,
        {"type": "chat_message", "message": read.model_dump(mode="json")},
    )
    return read
