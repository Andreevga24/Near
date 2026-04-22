"""
Доступ к переопределениям сценарных пресетов (kind_presets) с fallback на константы.
"""

from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.task_templates import COLUMN_HINTS, DEFAULT_CHECKLISTS
from app.models.kind_preset import KindPreset


def _safe_json_obj(text: str) -> dict:
    try:
        v = json.loads(text or "{}")
        return v if isinstance(v, dict) else {}
    except Exception:
        return {}


async def get_effective_kind_preset(session: AsyncSession, kind: str) -> tuple[dict[str, str], dict[str, list[str]]]:
    default_hints = dict(COLUMN_HINTS.get(kind, {}))
    default_checklists = {k: list(v) for k, v in DEFAULT_CHECKLISTS.get(kind, {}).items()}

    res = await session.execute(select(KindPreset).where(KindPreset.kind == kind))
    row = res.scalar_one_or_none()
    if row is None:
        return default_hints, default_checklists

    hints = _safe_json_obj(row.column_hints_json)
    checklists = _safe_json_obj(row.default_checklists_json)

    # merge: overrides win
    eff_hints = {**default_hints, **{k: str(v) for k, v in hints.items() if isinstance(k, str)}}

    eff_checklists: dict[str, list[str]] = {**default_checklists}
    for status, items in checklists.items():
        if not isinstance(status, str) or not isinstance(items, list):
            continue
        eff_checklists[status] = [str(x) for x in items if isinstance(x, (str, int, float))]

    return eff_hints, eff_checklists

