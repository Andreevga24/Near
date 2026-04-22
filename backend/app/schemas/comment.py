"""
Схемы комментариев к задачам.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CommentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    author_id: UUID | None
    author_email: str | None = None
    body: str
    created_at: datetime
    mentions: list[str] = []


class CommentCreate(BaseModel):
    task_id: UUID
    body: str = Field(..., min_length=1, max_length=50_000)

