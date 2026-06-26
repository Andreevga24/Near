"""Схемы отчётов."""

from uuid import UUID

from pydantic import BaseModel, Field


class StatusCount(BaseModel):
    status: str
    count: int


class ProjectReportSlice(BaseModel):
    project_id: UUID
    project_name: str
    active_total: int
    archived_total: int


class ReportsSummaryRead(BaseModel):
    project_id: UUID | None = None
    active_total: int = 0
    archived_total: int = 0
    closed_last_7_days: int = 0
    closed_last_30_days: int = 0
    with_due: int = 0
    overdue: int = 0
    due_soon: int = 0
    by_status: list[StatusCount] = Field(default_factory=list)
    by_project: list[ProjectReportSlice] = Field(default_factory=list)


class BurndownPoint(BaseModel):
    date: str
    closed_count: int
    remaining_active: int


class AssigneeSlice(BaseModel):
    assignee_id: UUID | None
    assignee_email: str | None
    overdue_count: int = 0
    in_progress_count: int = 0


class ReportsDashboardRead(BaseModel):
    project_id: UUID | None = None
    burndown: list[BurndownPoint] = Field(default_factory=list)
    in_progress: list[StatusCount] = Field(default_factory=list)
    overdue_by_assignee: list[AssigneeSlice] = Field(default_factory=list)
    time_total_seconds: int = 0
