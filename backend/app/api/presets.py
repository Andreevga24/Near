"""
API для сценарных пресетов: подсказки колонок и дефолтные чеклисты по kind.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.kind_preset import KindPreset
from app.models.user import User
from app.schemas.presets import KindPresetRead, KindPresetUpsert
from app.services.presets import get_effective_kind_preset


router = APIRouter(prefix="/presets", tags=["presets"])


@router.get("/{kind}", response_model=KindPresetRead)
async def read_kind_preset(
    kind: str,
    _user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> KindPresetRead:
    hints, checklists = await get_effective_kind_preset(session, kind)
    return KindPresetRead(kind=kind, column_hints=hints, default_checklists=checklists)


@router.put("/{kind}", response_model=KindPresetRead)
async def upsert_kind_preset(
    kind: str,
    payload: KindPresetUpsert,
    _user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> KindPresetRead:
    res = await session.execute(select(KindPreset).where(KindPreset.kind == kind))
    row = res.scalar_one_or_none()
    if row is None:
        row = KindPreset(kind=kind)
        session.add(row)

    row.column_hints_json = json.dumps(payload.column_hints, ensure_ascii=False)
    row.default_checklists_json = json.dumps(payload.default_checklists, ensure_ascii=False)
    await session.commit()

    hints, checklists = await get_effective_kind_preset(session, kind)
    return KindPresetRead(kind=kind, column_hints=hints, default_checklists=checklists)

