"""
Схемы пунктов чеклиста.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChecklistItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    text: str
    is_done: bool
    position: int
    created_at: datetime


class ChecklistItemCreate(BaseModel):
    task_id: UUID
    text: str = Field(..., min_length=1, max_length=5000)
    position: int | None = Field(default=None, ge=0)


class ChecklistItemUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=5000)
    is_done: bool | None = None
    position: int | None = Field(default=None, ge=0)


class ChecklistReorder(BaseModel):
    task_id: UUID
    ordered_item_ids: list[UUID]

