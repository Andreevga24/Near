"""
Схемы проекта для CRUD API.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProjectRead(BaseModel):
    """Проект в ответах API."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    owner_id: UUID
    created_at: datetime
    updated_at: datetime


class ProjectCreate(BaseModel):
    """Создание проекта."""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = Field(None, max_length=10_000)


class ProjectUpdate(BaseModel):
    """Обновление проекта (переданные поля заменяются)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = Field(None, max_length=10_000)
