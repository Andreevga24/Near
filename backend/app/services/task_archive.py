"""
Архив закрытых задач: срок хранения и очистка просроченных записей.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.task import Task


def archive_retention_days() -> int:
    return max(1, int(settings.TASK_ARCHIVE_RETENTION_DAYS))


def archive_expires_at(closed_at: datetime) -> datetime:
    """Момент окончательного удаления задачи из архива."""
    d = closed_at
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d + timedelta(days=archive_retention_days())


async def purge_expired_archived_tasks(session: AsyncSession) -> int:
    """Удаляет задачи, у которых истёк срок хранения в архиве."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=archive_retention_days())
    result = await session.execute(
        delete(Task).where(Task.closed_at.isnot(None), Task.closed_at < cutoff),
    )
    await session.commit()
    return int(result.rowcount or 0)
