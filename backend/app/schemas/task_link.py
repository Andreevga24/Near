"""
Схемы связей задач (blocks/relates).
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TaskLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    from_task_id: UUID
    to_task_id: UUID
    type: str
    created_at: datetime


class TaskLinkCreate(BaseModel):
    project_id: UUID
    from_task_id: UUID
    to_task_id: UUID
    type: str = Field(..., pattern=r"^(blocks|relates)$")

