"""
Общие проверки доступа: проект и задача принадлежат текущему владельцу.
Вынесено из роутеров, чтобы не дублировать запросы и логику 404.
"""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.models.user import User


async def get_owned_project_or_404(
    session: AsyncSession,
    user: User,
    project_id: UUID,
) -> Project:
    """Проект по id принадлежит пользователю; иначе 404 (без утечки существования чужого проекта)."""
    result = await session.execute(
        select(Project).where(Project.id == project_id, Project.owner_id == user.id),
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )
    return project


async def get_owned_task_or_404(
    session: AsyncSession,
    user: User,
    task_id: UUID,
) -> Task:
    """Задача существует и входит в проект владельца; иначе 404."""
    result = await session.execute(
        select(Task)
        .join(Project, Task.project_id == Project.id)
        .where(Task.id == task_id, Project.owner_id == user.id),
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена",
        )
    return task
