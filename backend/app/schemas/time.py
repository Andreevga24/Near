"""Схемы тайм-трекинга."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TimeStart(BaseModel):
    task_id: UUID


class TimeEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    task_id: UUID
    user_id: UUID
    started_at: datetime
    stopped_at: datetime | None
    duration_seconds: int | None = None
    task_title: str | None = None


class TimeByTask(BaseModel):
    task_id: UUID
    task_title: str
    total_seconds: int


class TimeByUser(BaseModel):
    user_id: UUID
    user_email: str
    total_seconds: int


class TimeReportRead(BaseModel):
    project_id: UUID | None = None
    total_seconds: int = 0
    by_task: list[TimeByTask] = Field(default_factory=list)
    by_user: list[TimeByUser] = Field(default_factory=list)
    entries: list[TimeEntryRead] = Field(default_factory=list)
