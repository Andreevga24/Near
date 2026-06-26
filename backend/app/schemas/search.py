"""Схемы глобального поиска."""

from uuid import UUID

from pydantic import BaseModel, Field


class SearchResultProject(BaseModel):
    id: UUID
    name: str
    kind: str


class SearchResultTask(BaseModel):
    id: UUID
    title: str
    project_id: UUID
    project_name: str
    status: str


class SearchRead(BaseModel):
    query: str = ""
    projects: list[SearchResultProject] = Field(default_factory=list)
    tasks: list[SearchResultTask] = Field(default_factory=list)
