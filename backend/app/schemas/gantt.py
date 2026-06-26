"""Схемы данных для диаграммы Ганта."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GanttTaskRead(BaseModel):
    id: UUID
    title: str
    status: str
    assignee_id: UUID | None
    start_at: datetime
    end_at: datetime
    blocked_by: list[UUID] = Field(default_factory=list)


class GanttLinkRead(BaseModel):
    from_task_id: UUID
    to_task_id: UUID
    type: str


class GanttRead(BaseModel):
    project_id: UUID
    project_name: str
    range_start: datetime
    range_end: datetime
    tasks: list[GanttTaskRead]
    links: list[GanttLinkRead]
