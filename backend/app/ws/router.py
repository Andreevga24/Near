"""
WebSocket: подписка на обновления канбана проекта /ws/{project_id}?token=JWT
"""

from uuid import UUID

from fastapi import APIRouter, Query, WebSocket, status

from app.db.session import AsyncSessionLocal
from app.api.access import user_can_access_project
from app.ws.auth import get_user_from_ws_token
from app.ws.hub import project_ws_hub, chat_ws_hub

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
        if not await user_can_access_project(session, user, project_id):
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


@router.websocket("/ws/chat/{channel_id}")
async def chat_channel_ws(
    websocket: WebSocket,
    channel_id: UUID,
    token: str | None = Query(
        default=None,
        description="JWT access_token",
    ),
) -> None:
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="missing_token")
        return

    async with AsyncSessionLocal() as session:
        user = await get_user_from_ws_token(session, token)
        if user is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="invalid_token")
            return
        from app.api.messenger_access import get_channel_or_404
        from fastapi import HTTPException

        try:
            await get_channel_or_404(session, user, channel_id)
        except HTTPException:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION, reason="channel_not_found")
            return

    await websocket.accept()
    await chat_ws_hub.add(channel_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    finally:
        await chat_ws_hub.remove(channel_id, websocket)
