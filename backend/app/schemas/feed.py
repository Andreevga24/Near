"""
Схемы глобальной ленты событий.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class FeedItemRead(BaseModel):
    id: str
    type: str
    created_at: datetime
    project_id: UUID
    project_name: str
    task_id: UUID | None = None
    task_title: str | None = None
    actor_id: UUID | None = None
    actor_email: str | None = None
    summary: str
    data: dict[str, object] = {}
    href: str

    model_config = ConfigDict(from_attributes=True)


class FeedRead(BaseModel):
    items: list[FeedItemRead]
