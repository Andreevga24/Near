"""
Утилиты для записи и чтения таймлайна задач.
"""

from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_activity import TaskActivity


async def add_activity(
    session: AsyncSession,
    *,
    task_id: UUID,
    actor_id: UUID | None,
    type: str,
    data: dict,
) -> TaskActivity:
    a = TaskActivity(
        task_id=task_id,
        actor_id=actor_id,
        type=type,
        data=json.dumps(data, ensure_ascii=False),
    )
    session.add(a)
    await session.commit()
    await session.refresh(a)
    return a

