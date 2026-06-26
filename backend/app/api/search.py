"""
Глобальный поиск по проектам и задачам пользователя.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import list_accessible_project_ids
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.search import SearchRead, SearchResultProject, SearchResultTask

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchRead)
async def global_search(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> SearchRead:
    needle = q.strip()
    if not needle:
        return SearchRead()

    accessible = await list_accessible_project_ids(session, user)
    if not accessible:
        return SearchRead()

    like = f"%{needle.lower()}%"

    proj_res = await session.execute(
        select(Project)
        .where(
            Project.id.in_(accessible),
            or_(
                func.lower(Project.name).like(like),
                func.lower(Project.description).like(like),
            ),
        )
        .order_by(Project.updated_at.desc())
        .limit(limit),
    )
    projects = [
        SearchResultProject(id=p.id, name=p.name, kind=p.kind)
        for p in proj_res.scalars().all()
    ]

    task_res = await session.execute(
        select(Task, Project.name)
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.project_id.in_(accessible),
            Task.closed_at.is_(None),
            or_(
                func.lower(Task.title).like(like),
                func.lower(Task.description).like(like),
            ),
        )
        .order_by(Task.updated_at.desc())
        .limit(limit),
    )
    tasks = [
        SearchResultTask(
            id=t.id,
            title=t.title,
            project_id=t.project_id,
            project_name=pname,
            status=t.status,
        )
        for t, pname in task_res.all()
    ]

    return SearchRead(projects=projects, tasks=tasks, query=needle)
