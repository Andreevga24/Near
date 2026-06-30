"""
Публичные read-only ответы для режима шаринга проекта.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.constants.project_kinds import ProjectKind
from app.schemas.task_link import TaskLinkRead


class PublicTaskRead(BaseModel):
    """Задача на публичной доске — без внутренних идентификаторов исполнителя."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    description: str | None
    status: str
    position: int
    priority: int
    due_at: datetime | None
    closed_at: datetime | None = None
    completed: bool | None = None
    created_at: datetime
    updated_at: datetime


class PublicProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    kind: ProjectKind
    created_at: datetime
    updated_at: datetime


class PublicProjectBoardRead(BaseModel):
    project: PublicProjectRead
    tasks: list[PublicTaskRead]
    links: list[TaskLinkRead]
    hidden_columns: list[str] = []
    watermark: str = "Near"


class ProjectShareRead(BaseModel):
    enabled: bool
    share_id: str | None
    expires_at: datetime | None = None
    hidden_columns: list[str] = []


class ProjectShareEnable(BaseModel):
    expires_in_days: int | None = Field(default=None, ge=1, le=365)
    hidden_columns: list[str] | None = None


class ProjectShareUpdate(BaseModel):
    expires_in_days: int | None = Field(default=None, ge=1, le=365)
    hidden_columns: list[str] | None = None
    clear_expiry: bool = False

