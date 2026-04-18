"""
CRUD проектов: только владелец (owner_id == текущий пользователь) видит и меняет свои проекты.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_project_or_404
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.project import Project
from app.models.user import User
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
    data = payload.model_dump(exclude_unset=True)
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
