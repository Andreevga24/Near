"""
CRUD проектов: только владелец (owner_id == текущий пользователь) видит и меняет свои проекты.
"""

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_project_or_404
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.project import Project
from app.models.user import User
from app.schemas.public import ProjectShareRead
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.ws.hub import project_ws_hub

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[Project]:
    """Список проектов текущего пользователя (новые сверху)."""
    result = await session.execute(
        select(Project)
        .where(Project.owner_id == user.id)
        .order_by(Project.created_at.desc()),
    )
    return list(result.scalars().all())


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Project:
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
    return project


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Project:
    """Обновить название/описание проекта."""
    project = await get_owned_project_or_404(session, user, project_id)
    data = payload.model_dump(exclude_unset=True, mode="json")
    if not data:
        return project
    for key, value in data.items():
        setattr(project, key, value)
    await session.commit()
    await session.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Удалить проект и все связанные задачи (каскад в БД)."""
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
    return ProjectShareRead(enabled=bool(project.is_public), share_id=project.share_id)


@router.put("/{project_id}/share/enable", response_model=ProjectShareRead)
async def enable_project_share(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectShareRead:
    project = await get_owned_project_or_404(session, user, project_id)
    if not project.share_id:
        # Достаточно случайного токена; не UUID, чтобы можно было менять формат без миграций.
        project.share_id = secrets.token_urlsafe(24)
    project.is_public = True
    await session.commit()
    await session.refresh(project)
    return ProjectShareRead(enabled=True, share_id=project.share_id)


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
    return ProjectShareRead(enabled=False, share_id=project.share_id)
