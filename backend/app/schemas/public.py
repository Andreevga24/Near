"""
Публичные read-only ответы для режима шаринга проекта.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.constants.project_kinds import ProjectKind
from app.schemas.task import TaskRead
from app.schemas.task_link import TaskLinkRead


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
    tasks: list[TaskRead]
    links: list[TaskLinkRead]


class ProjectShareRead(BaseModel):
    enabled: bool
    share_id: str | None

