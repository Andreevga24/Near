"""Схемы мессенджера."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatChannelCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    project_id: UUID | None = None
    task_id: UUID | None = None


class ChatChannelRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    project_id: UUID | None
    task_id: UUID | None
    created_by_user_id: UUID
    created_at: datetime
    message_count: int = 0


class ChatMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)


class ChatMessageRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    channel_id: UUID
    user_id: UUID
    author_email: str
    text: str
    created_at: datetime
