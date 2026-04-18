"""
WebSocket: подписка на обновления канбана проекта /ws/{project_id}?token=JWT
"""

from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, status

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.project import Project
from app.ws.auth import get_user_from_ws_token
from app.ws.hub import project_ws_hub

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/{project_id}")
async def project_kanban_ws(
    websocket: WebSocket,
    project_id: UUID,
    token: str | None = Query(
        default=None,
        description="JWT access_token (тот же, что выдаёт POST /login)",
    ),
) -> None:
    """
    Живые обновления задач проекта.

    Подключение: ``ws://host/ws/{project_id}?token=<access_token>``
    Сервер рассылает JSON при создании/изменении/удалении задач (см. CRUD /tasks).
    Сообщения от клиента читаются и отбрасываются (можно использовать как keep-alive).
    """
    if not token:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="missing_token",
        )
        return

    async with AsyncSessionLocal() as session:
        user = await get_user_from_ws_token(session, token)
        if user is None:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="invalid_token",
            )
            return
        result = await session.execute(
            select(Project.id).where(
                Project.id == project_id,
                Project.owner_id == user.id,
            ),
        )
        if result.scalar_one_or_none() is None:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="project_not_found",
            )
            return

    await websocket.accept()
    await project_ws_hub.add(project_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    finally:
        await project_ws_hub.remove(project_id, websocket)
