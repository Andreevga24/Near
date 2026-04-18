"""
Хаб WebSocket: комнаты по project_id, рассылка JSON-событий подписчикам.
"""

import asyncio
import logging
from collections import defaultdict
from typing import Any
from uuid import UUID

from starlette.websockets import WebSocket, WebSocketState

logger = logging.getLogger(__name__)


class ProjectWSHub:
    """
    Для каждого проекта хранится множество активных WebSocket.
    Отправка идёт без удержания lock на время I/O (только на копирование списка).
    """

    def __init__(self) -> None:
        self._rooms: dict[UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def add(self, project_id: UUID, websocket: WebSocket) -> None:
        """Регистрация соединения после успешного accept()."""
        async with self._lock:
            self._rooms[project_id].add(websocket)

    async def remove(self, project_id: UUID, websocket: WebSocket) -> None:
        """Снятие соединения при отключении клиента."""
        async with self._lock:
            room = self._rooms.get(project_id)
            if not room:
                return
            room.discard(websocket)
            if not room:
                del self._rooms[project_id]

    async def broadcast_json(self, project_id: UUID, payload: dict[str, Any]) -> None:
        """Отправить одно и то же JSON-сообщение всем подписчикам проекта."""
        async with self._lock:
            targets = list(self._rooms.get(project_id, ()))
        for ws in targets:
            if ws.client_state != WebSocketState.CONNECTED:
                await self.remove(project_id, ws)
                continue
            try:
                await ws.send_json(payload)
            except Exception as exc:  # noqa: BLE001 — шлём остальным даже при сбое одного клиента
                logger.debug("Ошибка WS send: %s", exc)
                await self.remove(project_id, ws)

    async def close_room(self, project_id: UUID, payload: dict[str, Any] | None = None) -> None:
        """Закрыть все сокеты комнаты (например, после удаления проекта)."""
        async with self._lock:
            targets = list(self._rooms.pop(project_id, ()))
        for ws in targets:
            try:
                if payload is not None and ws.client_state == WebSocketState.CONNECTED:
                    await ws.send_json(payload)
                await ws.close(code=1001, reason="project_closed")
            except Exception as exc:  # noqa: BLE001
                logger.debug("Ошибка при закрытии WS: %s", exc)


# Один экземпляр на процесс Uvicorn (воркер)
project_ws_hub = ProjectWSHub()
