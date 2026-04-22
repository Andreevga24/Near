"""
CRUD связей задач (blocks/relates): доступ только к проектам текущего владельца.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import get_owned_project_or_404, get_owned_task_or_404
from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.task_link import TaskLink
from app.models.user import User
from app.schemas.task_link import TaskLinkCreate, TaskLinkRead
from app.services.timeline import add_activity
from app.ws.hub import project_ws_hub

router = APIRouter(prefix="/task-links", tags=["task-links"])

def _link_ws_payload(event: str, project_id: UUID, from_task_id: UUID, to_task_id: UUID, type: str) -> dict[str, str]:
    return {
        "type": event,
        "project_id": str(project_id),
        "from_task_id": str(from_task_id),
        "to_task_id": str(to_task_id),
        "link_type": type,
    }


@router.get("", response_model=list[TaskLinkRead])
async def list_task_links(
    project_id: UUID = Query(..., description="Идентификатор проекта"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[TaskLink]:
    await get_owned_project_or_404(session, user, project_id)
    result = await session.execute(
        select(TaskLink)
        .where(TaskLink.project_id == project_id)
        .order_by(TaskLink.type.asc(), TaskLink.created_at.asc()),
    )
    return list(result.scalars().all())


def _is_self_link(payload: TaskLinkCreate) -> bool:
    return payload.from_task_id == payload.to_task_id


@router.post("", response_model=TaskLinkRead, status_code=status.HTTP_201_CREATED)
async def create_task_link(
    payload: TaskLinkCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> TaskLink:
    if _is_self_link(payload):
        raise HTTPException(status_code=400, detail="Нельзя создавать связь задачи с самой собой")

    await get_owned_project_or_404(session, user, payload.project_id)
    from_task = await get_owned_task_or_404(session, user, payload.from_task_id)
    to_task = await get_owned_task_or_404(session, user, payload.to_task_id)
    if from_task.project_id != payload.project_id or to_task.project_id != payload.project_id:
        raise HTTPException(status_code=400, detail="Обе задачи должны принадлежать одному проекту")

    link = TaskLink(
        project_id=payload.project_id,
        from_task_id=payload.from_task_id,
        to_task_id=payload.to_task_id,
        type=payload.type,
    )
    session.add(link)

    if payload.type == "relates":
        # Храним relates как пару направленных рёбер для простого рендера на фронте.
        rev = TaskLink(
            project_id=payload.project_id,
            from_task_id=payload.to_task_id,
            to_task_id=payload.from_task_id,
            type=payload.type,
        )
        session.add(rev)

    await session.commit()
    await session.refresh(link)
    await add_activity(
        session,
        task_id=payload.from_task_id,
        actor_id=user.id,
        type="link_created",
        data={"from_task_id": str(payload.from_task_id), "to_task_id": str(payload.to_task_id), "link_type": payload.type},
    )
    await add_activity(
        session,
        task_id=payload.to_task_id,
        actor_id=user.id,
        type="link_created",
        data={"from_task_id": str(payload.from_task_id), "to_task_id": str(payload.to_task_id), "link_type": payload.type},
    )
    await project_ws_hub.broadcast_json(
        payload.project_id,
        _link_ws_payload(
            "link_created",
            payload.project_id,
            payload.from_task_id,
            payload.to_task_id,
            payload.type,
        ),
    )
    return link


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task_link(
    project_id: UUID = Query(...),
    from_task_id: UUID = Query(...),
    to_task_id: UUID = Query(...),
    type: str = Query(..., pattern=r"^(blocks|relates)$"),
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    await get_owned_project_or_404(session, user, project_id)
    await get_owned_task_or_404(session, user, from_task_id)
    await get_owned_task_or_404(session, user, to_task_id)

    cond = and_(
        TaskLink.project_id == project_id,
        TaskLink.type == type,
        TaskLink.from_task_id == from_task_id,
        TaskLink.to_task_id == to_task_id,
    )
    stmt = delete(TaskLink).where(cond)

    if type == "relates":
        # Удаляем обе направленные записи.
        stmt = delete(TaskLink).where(
            and_(
                TaskLink.project_id == project_id,
                TaskLink.type == type,
                or_(
                    and_(
                        TaskLink.from_task_id == from_task_id,
                        TaskLink.to_task_id == to_task_id,
                    ),
                    and_(
                        TaskLink.from_task_id == to_task_id,
                        TaskLink.to_task_id == from_task_id,
                    ),
                ),
            ),
        )

    await session.execute(stmt)
    await session.commit()
    await add_activity(
        session,
        task_id=from_task_id,
        actor_id=user.id,
        type="link_deleted",
        data={"from_task_id": str(from_task_id), "to_task_id": str(to_task_id), "link_type": type},
    )
    await add_activity(
        session,
        task_id=to_task_id,
        actor_id=user.id,
        type="link_deleted",
        data={"from_task_id": str(from_task_id), "to_task_id": str(to_task_id), "link_type": type},
    )
    await project_ws_hub.broadcast_json(
        project_id,
        _link_ws_payload(
            "link_deleted",
            project_id,
            from_task_id,
            to_task_id,
            type,
        ),
    )

