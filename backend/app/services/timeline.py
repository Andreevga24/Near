"""
Запись активности по задаче + уведомления участникам.
"""

from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.task import Task
from app.models.task_activity import TaskActivity
from app.services.notifications import fan_out_activity_notifications


async def add_activity(
    session: AsyncSession,
    *,
    task_id: UUID,
    actor_id: UUID | None,
    type: str,
    data: dict[str, object],
    notify: bool = True,
    extra_notify_user_ids: list[UUID] | None = None,
    email_user_ids: set[UUID] | None = None,
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
    if notify:
        task = await session.get(Task, task_id)
        if task is not None:
            project = await session.get(Project, task.project_id)
            if project is not None:
                await fan_out_activity_notifications(
                    session,
                    activity=a,
                    task=task,
                    project=project,
                    actor_id=actor_id,
                    extra_user_ids=extra_notify_user_ids,
                    email_user_ids=email_user_ids,
                )
    return a
