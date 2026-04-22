"""
Схемы таймлайна (ленты активности) по задаче.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TimelineEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    type: str
    created_at: datetime
    actor_id: UUID | None
    actor_email: str | None = None
    data: dict

