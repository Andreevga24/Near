"""
CRUD задач: доступ только к задачам проектов, которыми владеет текущий пользователь.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_project_or_404, get_owned_task_or_404
from app.constants.board_presets import first_status_for_kind
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.ws.hub import project_ws_hub

router = APIRouter(prefix="/tasks", tags=["tasks"])


def _task_ws_payload(event: str, task_id: UUID, project_id: UUID) -> dict[str, str]:
    """Событие для фронтенда канбана (единый формат)."""
    return {
        "type": event,
        "task_id": str(task_id),
        "project_id": str(project_id),
    }


@router.get("", response_model=list[TaskRead])
async def list_tasks(
    project_id: UUID = Query(..., description="Идентификатор проекта"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[Task]:
    """Список задач выбранного проекта (сортировка: колонка канбана, затем порядок)."""
    await get_owned_project_or_404(session, user, project_id)
    result = await session.execute(
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.status.asc(), Task.position.asc(), Task.created_at.asc()),
    )
    return list(result.scalars().all())


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Создать задачу в проекте текущего пользователя."""
    project = await get_owned_project_or_404(session, user, payload.project_id)
    if payload.assignee_id is not None:
        res = await session.execute(select(User.id).where(User.id == payload.assignee_id))
        if res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Исполнитель с указанным id не найден",
            )
    eff_status = payload.status if payload.status is not None else first_status_for_kind(project.kind)
    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        status=eff_status,
        position=payload.position,
        assignee_id=payload.assignee_id,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    await project_ws_hub.broadcast_json(
        payload.project_id,
        _task_ws_payload("task_created", task.id, payload.project_id),
    )
    return task


@router.put("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Обновить поля задачи (переданные ключи)."""
    task = await get_owned_task_or_404(session, user, task_id)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return task
    aid = data.get("assignee_id")
    if aid is not None:
        res = await session.execute(select(User.id).where(User.id == aid))
        if res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Исполнитель с указанным id не найден",
            )
    for key, value in data.items():
        setattr(task, key, value)
    await session.commit()
    await session.refresh(task)
    await project_ws_hub.broadcast_json(
        task.project_id,
        _task_ws_payload("task_updated", task.id, task.project_id),
    )
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Удалить задачу и её комментарии (каскад в БД)."""
    task = await get_owned_task_or_404(session, user, task_id)
    project_id = task.project_id
    await session.delete(task)
    await session.commit()
    await project_ws_hub.broadcast_json(
        project_id,
        _task_ws_payload("task_deleted", task_id, project_id),
    )
