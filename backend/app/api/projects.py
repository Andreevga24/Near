"""
CRUD проектов: владелец и участники (editor/viewer) видят свои проекты.
"""

import json
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_editable_project_or_404, get_owned_project_or_404, get_project_role_or_404, resolve_project_role
from app.auth.manager import current_active_user
from app.constants.project_roles import ProjectRole
from app.db.session import get_async_session
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.models.user import User
from app.schemas.public import ProjectShareEnable, ProjectShareRead, ProjectShareUpdate
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.task import TaskRead
from app.services.presets import get_effective_starter_tasks
from app.ws.hub import project_ws_hub

router = APIRouter(prefix="/projects", tags=["projects"])


def _parse_hidden_columns(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        v = json.loads(raw)
        if isinstance(v, list):
            return [str(x) for x in v if isinstance(x, str) and x.strip()]
    except json.JSONDecodeError:
        pass
    return []


def _share_read(project: Project) -> ProjectShareRead:
    return ProjectShareRead(
        enabled=bool(project.is_public),
        share_id=project.share_id,
        expires_at=project.share_expires_at,
        hidden_columns=_parse_hidden_columns(project.public_hidden_columns),
    )


def _project_read(project: Project, role: ProjectRole) -> ProjectRead:
    data = ProjectRead.model_validate(project)
    return data.model_copy(update={"my_role": role.value})


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[ProjectRead]:
    """Проекты, где пользователь владелец или участник."""
    member_project_ids = select(ProjectMember.project_id).where(ProjectMember.user_id == user.id)
    result = await session.execute(
        select(Project)
        .where(or_(Project.owner_id == user.id, Project.id.in_(member_project_ids)))
        .order_by(Project.created_at.desc()),
    )
    projects = list(result.scalars().all())
    out: list[ProjectRead] = []
    for project in projects:
        role = await resolve_project_role(session, user, project)
        if role is not None:
            out.append(_project_read(project, role))
    return out


@router.get("/{project_id}", response_model=ProjectRead)
async def read_project(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectRead:
    project, role = await get_project_role_or_404(session, user, project_id)
    return _project_read(project, role)


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectRead:
    """Создать проект; владелец — текущий пользователь."""
    project = Project(
        name=payload.name,
        description=payload.description,
        owner_id=user.id,
        kind=payload.kind.value,
    )
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return _project_read(project, ProjectRole.OWNER)


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectRead:
    """Обновить название/описание проекта (только владелец)."""
    project = await get_owned_project_or_404(session, user, project_id)
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        return _project_read(project, ProjectRole.OWNER)
    for key, value in data.items():
        setattr(project, key, value)
    await session.commit()
    await session.refresh(project)
    return _project_read(project, ProjectRole.OWNER)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Удалить проект и все связанные задачи (только владелец)."""
    project = await get_owned_project_or_404(session, user, project_id)
    await session.delete(project)
    await session.commit()
    await project_ws_hub.close_room(
        project_id,
        {"type": "project_deleted", "project_id": str(project_id)},
    )


@router.get("/{project_id}/share", response_model=ProjectShareRead)
async def read_project_share(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectShareRead:
    project = await get_owned_project_or_404(session, user, project_id)
    return _share_read(project)


@router.put("/{project_id}/share/enable", response_model=ProjectShareRead)
async def enable_project_share(
    project_id: UUID,
    payload: ProjectShareEnable = Body(default_factory=ProjectShareEnable),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectShareRead:
    project = await get_owned_project_or_404(session, user, project_id)
    if not project.share_id:
        project.share_id = secrets.token_urlsafe(24)
    project.is_public = True
    body = payload
    if body.expires_in_days is not None:
        project.share_expires_at = datetime.now(timezone.utc) + timedelta(days=body.expires_in_days)
    if body.hidden_columns is not None:
        project.public_hidden_columns = json.dumps(body.hidden_columns, ensure_ascii=False)
    await session.commit()
    await session.refresh(project)
    return _share_read(project)


@router.post("/{project_id}/starter-tasks", response_model=list[TaskRead])
async def apply_starter_tasks(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[TaskRead]:
    """Создать стартовые задачи по шаблону kind (если проект пуст)."""
    project = await get_editable_project_or_404(session, user, project_id)
    existing = await session.execute(
        select(Task.id).where(Task.project_id == project.id, Task.closed_at.is_(None)).limit(1),
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="В проекте уже есть активные задачи")

    templates = await get_effective_starter_tasks(session, project.kind)
    if not templates:
        return []

    created: list[Task] = []
    for i, tmpl in enumerate(templates):
        task = Task(
            project_id=project.id,
            title=tmpl["title"],
            status=tmpl.get("status", "todo"),
            position=i,
        )
        session.add(task)
        created.append(task)
    await session.commit()
    for t in created:
        await session.refresh(t)
    return [TaskRead.model_validate(t) for t in created]


@router.patch("/{project_id}/share", response_model=ProjectShareRead)
async def update_project_share(
    project_id: UUID,
    payload: ProjectShareUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectShareRead:
    project = await get_owned_project_or_404(session, user, project_id)
    if payload.clear_expiry:
        project.share_expires_at = None
    elif payload.expires_in_days is not None:
        project.share_expires_at = datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days)
    if payload.hidden_columns is not None:
        project.public_hidden_columns = json.dumps(payload.hidden_columns, ensure_ascii=False)
    await session.commit()
    await session.refresh(project)
    return _share_read(project)


@router.put("/{project_id}/share/disable", response_model=ProjectShareRead)
async def disable_project_share(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectShareRead:
    project = await get_owned_project_or_404(session, user, project_id)
    project.is_public = False
    await session.commit()
    await session.refresh(project)
    return _share_read(project)
