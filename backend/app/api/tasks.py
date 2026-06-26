"""
CRUD задач: доступ только к задачам проектов, которыми владеет текущий пользователь.
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import (
    ensure_assignee_in_project,
    get_editable_project_or_404,
    get_owned_project_or_404,
    get_owned_task_or_404,
    get_readable_project_or_404,
    list_accessible_project_ids,
)
from app.constants.board_presets import first_status_for_kind
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.project import Project
from app.models.task import Task
from app.models.task_checklist_item import TaskChecklistItem
from app.models.user import User
from app.schemas.task import (
    ArchivedCountRead,
    ArchivedPurge,
    ArchivedTasksRead,
    TaskClose,
    TaskCopy,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from app.services.presets import get_effective_kind_preset
from app.services.task_archive import archive_retention_days, purge_expired_archived_tasks
from app.services.timeline import add_activity
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
    """Список активных задач проекта (без архива)."""
    await get_readable_project_or_404(session, user, project_id)
    await purge_expired_archived_tasks(session)
    result = await session.execute(
        select(Task)
        .where(Task.project_id == project_id, Task.closed_at.is_(None))
        .order_by(Task.status.asc(), Task.position.asc(), Task.created_at.asc()),
    )
    return list(result.scalars().all())


@router.get("/archived", response_model=ArchivedTasksRead)
async def list_archived_tasks(
    project_id: UUID = Query(..., description="Идентификатор проекта"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ArchivedTasksRead:
    """Закрытые задачи в архиве (до истечения срока хранения)."""
    await get_readable_project_or_404(session, user, project_id)
    await purge_expired_archived_tasks(session)
    result = await session.execute(
        select(Task)
        .where(Task.project_id == project_id, Task.closed_at.isnot(None))
        .order_by(Task.closed_at.desc()),
    )
    return ArchivedTasksRead(
        retention_days=archive_retention_days(),
        tasks=list(result.scalars().all()),
    )


@router.get("/archived/count", response_model=ArchivedCountRead)
async def archived_tasks_count(
    project_id: UUID | None = Query(None, description="Опционально — только этот проект"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ArchivedCountRead:
    """Количество задач в архиве (по всем проектам пользователя или одному)."""
    if project_id is not None:
        await get_readable_project_or_404(session, user, project_id)
    await purge_expired_archived_tasks(session)
    accessible = await list_accessible_project_ids(session, user)
    if not accessible:
        return ArchivedCountRead(total=0)
    stmt = (
        select(func.count(Task.id))
        .where(Task.project_id.in_(accessible), Task.closed_at.isnot(None))
    )
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    total = int((await session.execute(stmt)).scalar_one() or 0)
    return ArchivedCountRead(total=total)


@router.post("/archived/purge", status_code=status.HTTP_204_NO_CONTENT)
async def purge_archived_tasks(
    payload: ArchivedPurge,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    """Безвозвратно удалить выбранные задачи из архива."""
    for task_id in payload.task_ids:
        task = await get_owned_task_or_404(session, user, task_id)
        if task.closed_at is None:
            raise HTTPException(status_code=400, detail="Можно удалять только задачи из архива")
    for task_id in payload.task_ids:
        task = await get_owned_task_or_404(session, user, task_id)
        project_id = task.project_id
        await session.delete(task)
        await session.commit()
        await project_ws_hub.broadcast_json(
            project_id,
            _task_ws_payload("task_deleted", task_id, project_id),
        )


async def _clone_task_with_checklist(
    session: AsyncSession,
    source: Task,
    *,
    project_id: UUID,
    title: str,
    position: int,
    status: str | None = None,
) -> Task:
    """Копия задачи и её чеклиста в указанный проект."""
    clone = Task(
        project_id=project_id,
        title=title,
        description=source.description,
        status=status if status is not None else source.status,
        position=position,
        priority=source.priority,
        due_at=source.due_at,
        assignee_id=source.assignee_id,
    )
    session.add(clone)
    await session.flush()
    res = await session.execute(
        select(TaskChecklistItem)
        .where(TaskChecklistItem.task_id == source.id)
        .order_by(TaskChecklistItem.position.asc(), TaskChecklistItem.created_at.asc()),
    )
    for item in res.scalars().all():
        session.add(
            TaskChecklistItem(
                task_id=clone.id,
                text=item.text,
                position=item.position,
                is_done=item.is_done,
            ),
        )
    await session.commit()
    await session.refresh(clone)
    return clone


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Создать задачу в проекте текущего пользователя."""
    project = await get_editable_project_or_404(session, user, payload.project_id)
    if payload.assignee_id is not None:
        res = await session.execute(select(User.id).where(User.id == payload.assignee_id))
        if res.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Исполнитель с указанным id не найден",
            )
        await ensure_assignee_in_project(session, payload.project_id, payload.assignee_id)
    eff_status = payload.status if payload.status is not None else first_status_for_kind(project.kind)
    task = Task(
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        status=eff_status,
        position=payload.position,
        priority=payload.priority,
        due_at=payload.due_at,
        assignee_id=payload.assignee_id,
    )
    session.add(task)
    await session.commit()
    await session.refresh(task)
    _, eff_checklists = await get_effective_kind_preset(session, project.kind)
    tmpl = tuple(eff_checklists.get(eff_status, ()))
    if tmpl:
        for i, text in enumerate(tmpl):
            session.add(TaskChecklistItem(task_id=task.id, text=text, position=i, is_done=False))
        await session.commit()
    await add_activity(
        session,
        task_id=task.id,
        actor_id=user.id,
        type="task_created",
        data={"title": task.title, "status": task.status},
    )
    await project_ws_hub.broadcast_json(
        payload.project_id,
        _task_ws_payload("task_created", task.id, payload.project_id),
    )
    return task


@router.post("/{task_id}/close", response_model=TaskRead)
async def close_task(
    task_id: UUID,
    payload: TaskClose,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Закрыть задачу и отправить в архив."""
    task = await get_owned_task_or_404(session, user, task_id)
    if task.closed_at is not None:
        raise HTTPException(status_code=400, detail="Задача уже закрыта")
    task.closed_at = datetime.now(timezone.utc)
    task.completed = payload.completed
    await session.commit()
    await session.refresh(task)
    await add_activity(
        session,
        task_id=task.id,
        actor_id=user.id,
        type="task_closed",
        data={"completed": payload.completed, "title": task.title},
    )
    await project_ws_hub.broadcast_json(
        task.project_id,
        _task_ws_payload("task_closed", task.id, task.project_id),
    )
    return task


@router.post("/{task_id}/restore", response_model=TaskRead)
async def restore_task(
    task_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Вернуть задачу из архива на доску."""
    task = await get_owned_task_or_404(session, user, task_id)
    if task.closed_at is None:
        raise HTTPException(status_code=400, detail="Задача не в архиве")
    task.closed_at = None
    task.completed = None
    await session.commit()
    await session.refresh(task)
    await add_activity(
        session,
        task_id=task.id,
        actor_id=user.id,
        type="task_restored",
        data={"title": task.title},
    )
    await project_ws_hub.broadcast_json(
        task.project_id,
        _task_ws_payload("task_restored", task.id, task.project_id),
    )
    return task


@router.post("/{task_id}/duplicate", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def duplicate_task(
    task_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Дублировать задачу в том же проекте (с чеклистом)."""
    source = await get_owned_task_or_404(session, user, task_id)
    if source.closed_at is not None:
        raise HTTPException(status_code=400, detail="Нельзя дублировать задачу из архива")
    res = await session.execute(
        select(func.max(Task.position)).where(
            Task.project_id == source.project_id,
            Task.status == source.status,
            Task.closed_at.is_(None),
        ),
    )
    max_pos = int(res.scalar_one_or_none() or 0)
    title = source.title if len(source.title) <= 492 else source.title[:492]
    clone = await _clone_task_with_checklist(
        session,
        source,
        project_id=source.project_id,
        title=f"{title} (копия)",
        position=max_pos + 1,
    )
    await add_activity(
        session,
        task_id=clone.id,
        actor_id=user.id,
        type="task_created",
        data={"title": clone.title, "status": clone.status, "duplicated_from": str(source.id)},
    )
    await project_ws_hub.broadcast_json(
        source.project_id,
        _task_ws_payload("task_created", clone.id, source.project_id),
    )
    return clone


@router.post("/{task_id}/copy", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def copy_task_to_project(
    task_id: UUID,
    payload: TaskCopy,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Скопировать задачу в другой проект (с чеклистом, без связей)."""
    source = await get_owned_task_or_404(session, user, task_id)
    if source.closed_at is not None:
        raise HTTPException(status_code=400, detail="Нельзя копировать задачу из архива")
    target = await get_editable_project_or_404(session, user, payload.project_id)
    status_val = first_status_for_kind(target.kind)
    res = await session.execute(
        select(func.max(Task.position)).where(
            Task.project_id == payload.project_id,
            Task.status == status_val,
            Task.closed_at.is_(None),
        ),
    )
    max_pos = int(res.scalar_one_or_none() or 0)
    clone = await _clone_task_with_checklist(
        session,
        source,
        project_id=payload.project_id,
        title=source.title,
        position=max_pos + 1,
        status=status_val,
    )
    await add_activity(
        session,
        task_id=clone.id,
        actor_id=user.id,
        type="task_created",
        data={"title": clone.title, "status": clone.status, "copied_from": str(source.id)},
    )
    await project_ws_hub.broadcast_json(
        payload.project_id,
        _task_ws_payload("task_created", clone.id, payload.project_id),
    )
    return clone


@router.put("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: UUID,
    payload: TaskUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Task:
    """Обновить поля задачи (переданные ключи)."""
    task = await get_owned_task_or_404(session, user, task_id)
    if task.closed_at is not None:
        raise HTTPException(status_code=400, detail="Нельзя редактировать задачу в архиве. Восстановите её на доску.")
    before_status = task.status
    before_title = task.title
    before_priority = getattr(task, "priority", 0)
    before_due = getattr(task, "due_at", None)
    before_assignee = task.assignee_id
    before_description = task.description
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
        await ensure_assignee_in_project(session, task.project_id, aid)
    for key, value in data.items():
        setattr(task, key, value)
    await session.commit()
    await session.refresh(task)
    if "status" in data and task.status != before_status:
        await add_activity(
            session,
            task_id=task.id,
            actor_id=user.id,
            type="task_status_changed",
            data={"from": before_status, "to": task.status},
        )
    if "title" in data and task.title != before_title:
        await add_activity(
            session,
            task_id=task.id,
            actor_id=user.id,
            type="task_title_changed",
            data={"from": before_title, "to": task.title},
        )
    if "description" in data and task.description != before_description:
        await add_activity(
            session,
            task_id=task.id,
            actor_id=user.id,
            type="task_description_changed",
            data={"from": before_description, "to": task.description},
        )
    if "priority" in data and getattr(task, "priority", 0) != before_priority:
        await add_activity(
            session,
            task_id=task.id,
            actor_id=user.id,
            type="task_priority_changed",
            data={"from": before_priority, "to": getattr(task, "priority", 0)},
        )
    if "due_at" in data and getattr(task, "due_at", None) != before_due:
        await add_activity(
            session,
            task_id=task.id,
            actor_id=user.id,
            type="task_due_changed",
            data={"from": str(before_due) if before_due else None, "to": str(getattr(task, "due_at", None)) if getattr(task, "due_at", None) else None},
        )
    if "assignee_id" in data and task.assignee_id != before_assignee:
        email_ids: set[UUID] = set()
        if task.assignee_id is not None:
            email_ids.add(task.assignee_id)
        await add_activity(
            session,
            task_id=task.id,
            actor_id=user.id,
            type="task_assignee_changed",
            data={
                "from": str(before_assignee) if before_assignee else None,
                "to": str(task.assignee_id) if task.assignee_id else None,
            },
            email_user_ids=email_ids,
        )
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
