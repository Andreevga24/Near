"""
Персональное workspace-хранилище пользователя (компания, мессенджер, поддержка).
"""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.user import User
from app.models.user_workspace_store import UserWorkspaceStore
from app.schemas.workspace import WORKSPACE_STORE_KEYS, WorkspaceStoreRead, WorkspaceStoreUpsert

router = APIRouter(prefix="/workspace", tags=["workspace"])

MAX_WORKSPACE_JSON_BYTES = 512_000


def _validate_store_key(store_key: str) -> str:
    if store_key not in WORKSPACE_STORE_KEYS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Неизвестный раздел workspace",
        )
    return store_key


async def _get_store_row(
    session: AsyncSession,
    user_id: UUID,
    store_key: str,
) -> UserWorkspaceStore | None:
    result = await session.execute(
        select(UserWorkspaceStore).where(
            UserWorkspaceStore.user_id == user_id,
            UserWorkspaceStore.store_key == store_key,
        ),
    )
    return result.scalar_one_or_none()


def _parse_data(raw: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


@router.get("/{store_key}", response_model=WorkspaceStoreRead)
async def read_workspace_store(
    store_key: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> WorkspaceStoreRead:
    key = _validate_store_key(store_key)
    row = await _get_store_row(session, user.id, key)
    if row is None:
        return WorkspaceStoreRead(store_key=key, data=None, updated_at=None)
    return WorkspaceStoreRead(
        store_key=key,
        data=_parse_data(row.data),
        updated_at=row.updated_at,
    )


@router.put("/{store_key}", response_model=WorkspaceStoreRead)
async def upsert_workspace_store(
    store_key: str,
    payload: WorkspaceStoreUpsert,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> WorkspaceStoreRead:
    key = _validate_store_key(store_key)
    encoded = json.dumps(payload.data, ensure_ascii=False)
    if len(encoded.encode("utf-8")) > MAX_WORKSPACE_JSON_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Слишком большой объём данных workspace",
        )
    row = await _get_store_row(session, user.id, key)
    if row is None:
        row = UserWorkspaceStore(user_id=user.id, store_key=key, data=encoded)
        session.add(row)
    else:
        row.data = encoded
    await session.commit()
    await session.refresh(row)
    return WorkspaceStoreRead(
        store_key=key,
        data=payload.data,
        updated_at=row.updated_at,
    )


@router.delete("/{store_key}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_workspace_store(
    store_key: str,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    key = _validate_store_key(store_key)
    row = await _get_store_row(session, user.id, key)
    if row is not None:
        await session.delete(row)
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
