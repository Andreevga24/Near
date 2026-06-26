"""
Схемы уведомлений пользователя.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NotificationRead(BaseModel):
    id: UUID
    type: str
    title: str
    body: str | None
    link: str | None
    project_id: UUID | None
    task_id: UUID | None
    read_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListRead(BaseModel):
    items: list[NotificationRead]
    unread_count: int


class NotificationMarkRead(BaseModel):
    ids: list[UUID] = Field(default_factory=list)
