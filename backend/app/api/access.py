"""
Проверки доступа к проектам и задачам с учётом ролей участников.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.project_roles import ROLE_LEVEL, ProjectRole
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.task import Task
from app.models.user import User


async def resolve_project_role(
    session: AsyncSession,
    user: User,
    project: Project,
) -> ProjectRole | None:
    """Роль пользователя в проекте или None, если нет доступа."""
    if project.owner_id == user.id:
        return ProjectRole.OWNER
    result = await session.execute(
        select(ProjectMember.role).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        ),
    )
    raw = result.scalar_one_or_none()
    if raw is None:
        return None
    try:
        return ProjectRole(raw)
    except ValueError:
        return None


async def get_project_for_user(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> tuple[Project, ProjectRole]:
    """Проект и роль пользователя; 404 если проект не существует или нет доступа."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    role = await resolve_project_role(session, user, project)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    return project, role


def _require_min_role(role: ProjectRole, minimum: ProjectRole) -> None:
    if ROLE_LEVEL[role] < ROLE_LEVEL[minimum]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав для этого действия",
        )


async def require_project_access(
    session: AsyncSession,
    user: User,
    project_id: UUID,
    minimum: ProjectRole,
) -> tuple[Project, ProjectRole]:
    """Проект с проверкой минимальной роли."""
    project, role = await get_project_for_user(session, user, project_id)
    _require_min_role(role, minimum)
    return project, role


async def get_owned_project_or_404(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> Project:
    """Только владелец проекта."""
    project, _role = await require_project_access(session, user, project_id, ProjectRole.OWNER)
    return project


async def get_readable_project_or_404(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> Project:
    """Чтение: viewer и выше."""
    project, _role = await require_project_access(session, user, project_id, ProjectRole.VIEWER)
    return project


async def get_editable_project_or_404(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> Project:
    """Изменение задач и контента: editor и выше."""
    project, _role = await require_project_access(session, user, project_id, ProjectRole.EDITOR)
    return project


async def get_project_role_or_404(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> tuple[Project, ProjectRole]:
    """Проект и роль (любой участник)."""
    return await get_project_for_user(session, user, project_id)


async def get_task_or_404(
    session: AsyncSession,
    user: User,
    task_id: UUID,
    minimum: ProjectRole = ProjectRole.VIEWER,
) -> Task:
    """Задача с проверкой доступа к проекту."""
    result = await session.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена",
        )
    await require_project_access(session, user, task.project_id, minimum)
    return task


async def get_owned_task_or_404(
    session: AsyncSession,
    user: User,
    task_id: UUID,
) -> Task:
    """Задача для редактирования (editor+)."""
    return await get_task_or_404(session, user, task_id, ProjectRole.EDITOR)


async def user_can_access_project(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> bool:
    """Есть ли у пользователя любой доступ к проекту."""
    result = await session.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        return False
    return await resolve_project_role(session, user, project) is not None


async def ensure_assignee_in_project(
    session: AsyncSession,
    project_id: UUID,
    assignee_id: UUID,
) -> None:
    """Исполнитель должен быть владельцем или участником проекта."""
    result = await session.execute(
        select(Project.id).where(Project.id == project_id, Project.owner_id == assignee_id),
    )
    if result.scalar_one_or_none() is not None:
        return
    result = await session.execute(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == assignee_id,
        ),
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Исполнитель должен быть участником проекта",
        )


async def list_accessible_project_ids(session: AsyncSession, user: User) -> list[UUID]:
    """Id проектов, где пользователь владелец или участник."""
    owned = await session.execute(select(Project.id).where(Project.owner_id == user.id))
    member = await session.execute(
        select(ProjectMember.project_id).where(ProjectMember.user_id == user.id),
    )
    ids = {row[0] for row in owned.all()} | {row[0] for row in member.all()}
    return list(ids)


async def list_project_participant_user_ids(session: AsyncSession, project_id: UUID) -> list[UUID]:
    """Владелец + участники проекта."""
    result = await session.execute(select(Project.owner_id).where(Project.id == project_id))
    owner_id = result.scalar_one_or_none()
    if owner_id is None:
        return []
    member_res = await session.execute(
        select(ProjectMember.user_id).where(ProjectMember.project_id == project_id),
    )
    ids = {owner_id}
    ids.update(row[0] for row in member_res.all())
    return list(ids)
