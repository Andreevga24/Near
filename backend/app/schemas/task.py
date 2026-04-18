"""
Схемы задачи для CRUD API.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TaskRead(BaseModel):
    """Задача в ответах API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    title: str
    description: str | None
    status: str
    position: int
    assignee_id: UUID | None
    created_at: datetime
    updated_at: datetime


class TaskCreate(BaseModel):
    """Создание задачи в указанном проекте (должен принадлежать текущему пользователю)."""

    project_id: UUID
    title: str = Field(..., min_length=1, max_length=500)
    description: str | None = Field(None, max_length=50_000)
    status: str = Field(default="todo", max_length=32)
    position: int = Field(default=0, ge=0)
    assignee_id: UUID | None = None


class TaskUpdate(BaseModel):
    """Частичное обновление задачи."""

    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = Field(None, max_length=50_000)
    status: str | None = Field(None, max_length=32)
    position: int | None = Field(None, ge=0)
    assignee_id: UUID | None = None
