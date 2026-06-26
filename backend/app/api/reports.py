"""
Агрегированные отчёты по задачам (активные + архив, velocity, dashboard, export).
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import list_accessible_project_ids
from app.auth.manager import current_active_user
from app.constants.board_presets import preset_for_kind
from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.task_time_entry import TaskTimeEntry
from app.models.user import User
from app.schemas.reports import (
    AssigneeSlice,
    BurndownPoint,
    ProjectReportSlice,
    ReportsDashboardRead,
    ReportsSummaryRead,
    StatusCount,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _resolve_project_ids(
    accessible: list[UUID],
    project_id: UUID | None,
) -> list[UUID]:
    if not accessible:
        return []
    if project_id is not None:
        if project_id not in accessible:
            return []
        return [project_id]
    return accessible


async def _load_tasks(session: AsyncSession, project_ids: list[UUID]) -> list[Task]:
    if not project_ids:
        return []
    result = await session.execute(select(Task).where(Task.project_id.in_(project_ids)))
    return list(result.scalars().all())


def _build_summary(tasks: list[Task], project_id: UUID | None, project_ids: list[UUID]) -> ReportsSummaryRead:
    now = _now()
    week_ahead = now + timedelta(days=7)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    active_total = 0
    archived_total = 0
    closed_last_7 = 0
    closed_last_30 = 0
    with_due = 0
    overdue = 0
    due_soon = 0
    by_status: dict[str, int] = {}

    for t in tasks:
        if t.closed_at is not None:
            archived_total += 1
            closed = _aware(t.closed_at)
            if closed >= week_ago:
                closed_last_7 += 1
            if closed >= month_ago:
                closed_last_30 += 1
            continue

        active_total += 1
        by_status[t.status] = by_status.get(t.status, 0) + 1
        if t.due_at is not None:
            with_due += 1
            due = _aware(t.due_at)
            if due < now:
                overdue += 1
            elif due <= week_ahead:
                due_soon += 1

    by_project: list[ProjectReportSlice] = []
    return ReportsSummaryRead(
        project_id=project_id,
        active_total=active_total,
        archived_total=archived_total,
        closed_last_7_days=closed_last_7,
        closed_last_30_days=closed_last_30,
        with_due=with_due,
        overdue=overdue,
        due_soon=due_soon,
        by_status=[
            StatusCount(status=s, count=c)
            for s, c in sorted(by_status.items(), key=lambda x: (-x[1], x[0]))
        ],
        by_project=by_project,
    )


@router.get("/summary", response_model=ReportsSummaryRead)
async def reports_summary(
    project_id: UUID | None = Query(default=None),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ReportsSummaryRead:
    accessible = await list_accessible_project_ids(session, user)
    project_ids = _resolve_project_ids(accessible, project_id)
    if not project_ids:
        return ReportsSummaryRead()

    tasks = await _load_tasks(session, project_ids)
    summary = _build_summary(tasks, project_id, project_ids)

    if project_id is None and len(project_ids) > 1:
        names_res = await session.execute(select(Project.id, Project.name).where(Project.id.in_(project_ids)))
        names = {row[0]: row[1] for row in names_res.all()}
        per_project: dict[UUID, tuple[int, int]] = {pid: (0, 0) for pid in project_ids}
        for t in tasks:
            slot = per_project.get(t.project_id)
            if slot is None:
                continue
            if t.closed_at is not None:
                per_project[t.project_id] = (slot[0], slot[1] + 1)
            else:
                per_project[t.project_id] = (slot[0] + 1, slot[1])
        summary.by_project = [
            ProjectReportSlice(
                project_id=pid,
                project_name=names.get(pid, "Проект"),
                active_total=per_project[pid][0],
                archived_total=per_project[pid][1],
            )
            for pid in sorted(project_ids, key=lambda p: names.get(p, ""))
        ]

    return summary


@router.get("/dashboard", response_model=ReportsDashboardRead)
async def reports_dashboard(
    project_id: UUID | None = Query(default=None),
    days: int = Query(default=14, ge=7, le=60),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ReportsDashboardRead:
    accessible = await list_accessible_project_ids(session, user)
    project_ids = _resolve_project_ids(accessible, project_id)
    if not project_ids:
        return ReportsDashboardRead(project_id=project_id)

    tasks = await _load_tasks(session, project_ids)
    now = _now()
    start_day = (now - timedelta(days=days - 1)).date()

    active_tasks = [t for t in tasks if t.closed_at is None]
    active_total = len(active_tasks)

    closed_by_day: dict[date, int] = {}
    for t in tasks:
        if t.closed_at is None:
            continue
        d = _aware(t.closed_at).date()
        if d >= start_day:
            closed_by_day[d] = closed_by_day.get(d, 0) + 1

    burndown: list[BurndownPoint] = []
    for i in range(days):
        d = start_day + timedelta(days=i)
        closed = closed_by_day.get(d, 0)
        closed_after = sum(c for day, c in closed_by_day.items() if day > d)
        burndown.append(
            BurndownPoint(
                date=d.isoformat(),
                closed_count=closed,
                remaining_active=active_total + closed_after,
            ),
        )

    in_progress_map: dict[str, int] = {}
    overdue_map: dict[UUID | None, tuple[int, int]] = {}
    assignee_emails: dict[UUID, str] = {}

    kinds_res = await session.execute(select(Project.id, Project.kind).where(Project.id.in_(project_ids)))
    kind_by_project = {row[0]: row[1] for row in kinds_res.all()}

    for t in active_tasks:
        kind = kind_by_project.get(t.project_id)
        preset = preset_for_kind(kind)
        terminals = {preset[-1]} if preset else set()
        if t.status in terminals:
            continue
        in_progress_map[t.status] = in_progress_map.get(t.status, 0) + 1

        overdue_flag = 0
        if t.due_at is not None and _aware(t.due_at) < now:
            overdue_flag = 1
        slot = overdue_map.get(t.assignee_id, (0, 0))
        overdue_map[t.assignee_id] = (slot[0] + overdue_flag, slot[1] + 1)
        if t.assignee_id is not None and t.assignee_id not in assignee_emails:
            email_res = await session.execute(select(User.email).where(User.id == t.assignee_id))
            email = email_res.scalar_one_or_none()
            if email:
                assignee_emails[t.assignee_id] = email

    since = now - timedelta(days=30)
    time_res = await session.execute(
        select(TaskTimeEntry)
        .join(Task, Task.id == TaskTimeEntry.task_id)
        .where(Task.project_id.in_(project_ids), TaskTimeEntry.started_at >= since),
    )
    time_total = 0
    for entry in time_res.scalars().all():
        if entry.stopped_at is None:
            time_total += max(0, int((now - _aware(entry.started_at)).total_seconds()))
        else:
            time_total += max(0, int((_aware(entry.stopped_at) - _aware(entry.started_at)).total_seconds()))

    overdue_by_assignee = [
        AssigneeSlice(
            assignee_id=aid,
            assignee_email=assignee_emails.get(aid) if aid else None,
            overdue_count=counts[0],
            in_progress_count=counts[1],
        )
        for aid, counts in sorted(overdue_map.items(), key=lambda x: (-x[1][0], str(x[0])))
    ]

    return ReportsDashboardRead(
        project_id=project_id,
        burndown=burndown,
        in_progress=[
            StatusCount(status=s, count=c)
            for s, c in sorted(in_progress_map.items(), key=lambda x: (-x[1], x[0]))
        ],
        overdue_by_assignee=overdue_by_assignee,
        time_total_seconds=time_total,
    )


def _csv_from_summary(summary: ReportsSummaryRead, dashboard: ReportsDashboardRead) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["metric", "value"])
    writer.writerow(["active_total", summary.active_total])
    writer.writerow(["archived_total", summary.archived_total])
    writer.writerow(["closed_last_7_days", summary.closed_last_7_days])
    writer.writerow(["closed_last_30_days", summary.closed_last_30_days])
    writer.writerow(["overdue", summary.overdue])
    writer.writerow(["due_soon", summary.due_soon])
    writer.writerow(["time_total_seconds", dashboard.time_total_seconds])
    writer.writerow([])
    writer.writerow(["status", "count"])
    for s in summary.by_status:
        writer.writerow([s.status, s.count])
    writer.writerow([])
    writer.writerow(["burndown_date", "closed", "remaining_active"])
    for p in dashboard.burndown:
        writer.writerow([p.date, p.closed_count, p.remaining_active])
    writer.writerow([])
    writer.writerow(["assignee_email", "overdue", "in_progress"])
    for a in dashboard.overdue_by_assignee:
        writer.writerow([a.assignee_email or "unassigned", a.overdue_count, a.in_progress_count])
    return buf.getvalue()


def _pdf_from_summary(summary: ReportsSummaryRead, dashboard: ReportsDashboardRead) -> bytes:
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=14)
    pdf.cell(0, 10, "Near - Report", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    lines = [
        f"Active tasks: {summary.active_total}",
        f"Archived: {summary.archived_total}",
        f"Closed (7d): {summary.closed_last_7_days}",
        f"Closed (30d): {summary.closed_last_30_days}",
        f"Overdue: {summary.overdue}",
        f"Due soon (7d): {summary.due_soon}",
        f"Time tracked (30d): {dashboard.time_total_seconds // 3600}h {(dashboard.time_total_seconds % 3600) // 60}m",
    ]
    for line in lines:
        pdf.cell(0, 7, line, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)
    pdf.set_font("Helvetica", style="B", size=11)
    pdf.cell(0, 8, "By status", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=10)
    for s in summary.by_status[:20]:
        pdf.cell(0, 6, f"  {s.status}: {s.count}", new_x="LMARGIN", new_y="NEXT")
    return pdf.output()


@router.get("/export")
async def export_reports(
    format: Literal["csv", "pdf"] = Query(default="csv"),
    project_id: UUID | None = Query(default=None),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    summary = await reports_summary(project_id=project_id, user=user, session=session)
    dashboard = await reports_dashboard(project_id=project_id, user=user, session=session)

    if format == "pdf":
        content = _pdf_from_summary(summary, dashboard)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="near-report.pdf"'},
        )

    csv_text = _csv_from_summary(summary, dashboard)
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="near-report.csv"'},
    )
