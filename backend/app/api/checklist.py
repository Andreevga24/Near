"""
CRUD пунктов чеклиста задач.
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_task_or_404
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.task_checklist_item import TaskChecklistItem
from app.models.user import User
from app.schemas.checklist import (
    ChecklistItemCreate,
    ChecklistItemRead,
    ChecklistItemUpdate,
    ChecklistReorder,
)
from app.services.timeline import add_activity


router = APIRouter(prefix="/checklist-items", tags=["checklist"])


@router.get("", response_model=list[ChecklistItemRead])
async def list_checklist_items(
    task_id: UUID = Query(...),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[TaskChecklistItem]:
    task = await get_owned_task_or_404(session, user, task_id)
    res = await session.execute(
        select(TaskChecklistItem)
        .where(TaskChecklistItem.task_id == task.id)
        .order_by(TaskChecklistItem.position.asc(), TaskChecklistItem.created_at.asc()),
    )
    return list(res.scalars().all())


@router.post("", response_model=ChecklistItemRead, status_code=status.HTTP_201_CREATED)
async def create_checklist_item(
    payload: ChecklistItemCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TaskChecklistItem:
    await get_owned_task_or_404(session, user, payload.task_id)
    if payload.position is None:
        res = await session.execute(
            select(func.coalesce(func.max(TaskChecklistItem.position), 0)).where(
                TaskChecklistItem.task_id == payload.task_id,
            ),
        )
        payload_pos = int(res.scalar_one() or 0) + 1
    else:
        payload_pos = payload.position
    item = TaskChecklistItem(task_id=payload.task_id, text=payload.text, position=payload_pos, is_done=False)
    session.add(item)
    await session.commit()
    await session.refresh(item)
    await add_activity(
        session,
        task_id=payload.task_id,
        actor_id=user.id,
        type="checklist_item_created",
        data={"text": payload.text},
    )
    return item


@router.put("/{item_id}", response_model=ChecklistItemRead)
async def update_checklist_item(
    item_id: UUID,
    payload: ChecklistItemUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TaskChecklistItem:
    res = await session.execute(select(TaskChecklistItem).where(TaskChecklistItem.id == item_id))
    item = res.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Пункт чеклиста не найден")
    await get_owned_task_or_404(session, user, item.task_id)

    before_done = item.is_done
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(item, k, v)
    await session.commit()
    await session.refresh(item)
    if "is_done" in data and item.is_done != before_done:
        await add_activity(
            session,
            task_id=item.task_id,
            actor_id=user.id,
            type="checklist_item_toggled",
            data={"text": item.text, "is_done": item.is_done},
        )
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_checklist_item(
    item_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    res = await session.execute(select(TaskChecklistItem).where(TaskChecklistItem.id == item_id))
    item = res.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Пункт чеклиста не найден")
    await get_owned_task_or_404(session, user, item.task_id)
    await add_activity(
        session,
        task_id=item.task_id,
        actor_id=user.id,
        type="checklist_item_deleted",
        data={"text": item.text},
    )
    await session.execute(delete(TaskChecklistItem).where(TaskChecklistItem.id == item_id))
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/reorder", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def reorder_checklist_items(
    payload: ChecklistReorder,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    task = await get_owned_task_or_404(session, user, payload.task_id)

    res = await session.execute(
        select(TaskChecklistItem.id).where(TaskChecklistItem.task_id == task.id),
    )
    existing = {x for (x,) in res.all()}
    requested = payload.ordered_item_ids
    if len(set(requested)) != len(requested):
        raise HTTPException(status_code=400, detail="ordered_item_ids содержит дубликаты")
    if set(requested) != existing:
        raise HTTPException(status_code=400, detail="ordered_item_ids должен содержать все пункты задачи")

    bump = 10_000
    await session.execute(
        update(TaskChecklistItem)
        .where(TaskChecklistItem.task_id == task.id)
        .values(position=TaskChecklistItem.position + bump),
    )
    for pos, item_id in enumerate(requested):
        await session.execute(
            update(TaskChecklistItem)
            .where(TaskChecklistItem.id == item_id)
            .values(position=pos),
        )
    await session.commit()
    await add_activity(
        session,
        task_id=task.id,
        actor_id=user.id,
        type="checklist_reordered",
        data={"count": len(requested)},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)

