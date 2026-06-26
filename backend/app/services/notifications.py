"""
Создание уведомлений и опциональная отправка email.
"""

from __future__ import annotations

import json
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import list_accessible_project_ids, list_project_participant_user_ids
from app.core.config import settings
from app.models.project import Project
from app.models.task import Task
from app.models.task_activity import TaskActivity
from app.models.user import User
from app.models.user_notification import UserNotification

logger = logging.getLogger(__name__)

ACTIVITY_LABELS: dict[str, str] = {
    "task_created": "Создана задача",
    "task_closed": "Задача закрыта",
    "task_restored": "Задача восстановлена",
    "task_status_changed": "Смена статуса",
    "task_title_changed": "Изменено название",
    "task_priority_changed": "Изменён приоритет",
    "task_due_changed": "Изменён дедлайн",
    "task_assignee_changed": "Назначен исполнитель",
    "comment_created": "Новый комментарий",
    "comment_deleted": "Комментарий удалён",
}


def _task_link(project_id: UUID, task_id: UUID) -> str:
    return f"/projects/{project_id}?task={task_id}"


def _activity_summary(activity_type: str, data: dict[str, object], task_title: str) -> str:
    label = ACTIVITY_LABELS.get(activity_type, activity_type)
    if activity_type == "task_status_changed":
        return f"{label}: {data.get('from')} → {data.get('to')}"
    if activity_type == "task_closed":
        completed = data.get("completed")
        return f"{label} ({'выполнена' if completed else 'не выполнена'})"
    if activity_type == "comment_created":
        body = str(data.get("body", ""))[:120]
        return f"{label}: {body}"
    if activity_type == "task_assignee_changed":
        return f"{label} для «{task_title}»"
    return f"{label}: «{task_title}»"


async def create_user_notification(
    session: AsyncSession,
    *,
    user_id: UUID,
    ntype: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    project_id: UUID | None = None,
    task_id: UUID | None = None,
    activity_id: UUID | None = None,
    send_email: bool = False,
) -> UserNotification:
    n = UserNotification(
        user_id=user_id,
        type=ntype,
        title=title,
        body=body,
        link=link,
        project_id=project_id,
        task_id=task_id,
        activity_id=activity_id,
    )
    session.add(n)
    await session.flush()
    if send_email:
        res = await session.execute(select(User.email).where(User.id == user_id))
        email = res.scalar_one_or_none()
        if email:
            send_email_notification(email, title, body or title, link)
    return n


def send_email_notification(to_email: str, subject: str, body: str, link: str | None = None) -> None:
    """Отправка email, если настроен SMTP; иначе логируем (MVP)."""
    if not settings.SMTP_HOST:
        logger.info("Email (SMTP не настроен) → %s: %s", to_email, subject)
        return
    msg = EmailMessage()
    msg["Subject"] = f"[Near] {subject}"
    msg["From"] = settings.NOTIFICATION_EMAIL_FROM or settings.SMTP_USER or "near@localhost"
    msg["To"] = to_email
    text = body
    if link:
        text = f"{body}\n\nОткрыть: {link}"
    msg.set_content(text)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                smtp.starttls()
                smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
    except Exception:
        logger.exception("Не удалось отправить email на %s", to_email)


async def fan_out_activity_notifications(
    session: AsyncSession,
    *,
    activity: TaskActivity,
    task: Task,
    project: Project,
    actor_id: UUID | None,
    extra_user_ids: list[UUID] | None = None,
    email_user_ids: set[UUID] | None = None,
) -> None:
    """Уведомить участников проекта о событии по задаче."""
    try:
        data = json.loads(activity.data or "{}")
        if not isinstance(data, dict):
            data = {}
    except json.JSONDecodeError:
        data = {}
    summary = _activity_summary(activity.type, data, task.title)
    title = ACTIVITY_LABELS.get(activity.type, activity.type)
    link = _task_link(project.id, task.id)
    participant_ids = await list_project_participant_user_ids(session, project.id)
    targets = set(participant_ids)
    if extra_user_ids:
        targets.update(extra_user_ids)
    if actor_id:
        targets.discard(actor_id)
    email_ids = email_user_ids or set()
    for uid in targets:
        await create_user_notification(
            session,
            user_id=uid,
            ntype=activity.type,
            title=title,
            body=summary,
            link=link,
            project_id=project.id,
            task_id=task.id,
            activity_id=activity.id,
            send_email=uid in email_ids,
        )
    await session.commit()


async def ensure_due_reminders(session: AsyncSession, user: User) -> None:
    """Создать напоминания о дедлайнах в ближайшие N часов (если ещё не отправляли)."""
    hours = settings.DUE_REMINDER_HOURS
    if hours <= 0:
        return
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=hours)
    project_ids = await list_accessible_project_ids(session, user)
    if not project_ids:
        return
    res = await session.execute(
        select(Task, Project)
        .join(Project, Task.project_id == Project.id)
        .where(
            Task.project_id.in_(project_ids),
            Task.closed_at.is_(None),
            Task.due_at.isnot(None),
            Task.due_at <= window_end,
            Task.due_at >= now,
        ),
    )
    for task, project in res.all():
        existing = await session.execute(
            select(UserNotification.id).where(
                UserNotification.user_id == user.id,
                UserNotification.task_id == task.id,
                UserNotification.type == "due_soon",
                UserNotification.created_at >= now - timedelta(hours=hours),
            ),
        )
        if existing.scalar_one_or_none() is not None:
            continue
        due_str = task.due_at.strftime("%d.%m.%Y %H:%M") if task.due_at else ""
        await create_user_notification(
            session,
            user_id=user.id,
            ntype="due_soon",
            title="Скоро дедлайн",
            body=f"«{task.title}» · {project.name} · до {due_str}",
            link=_task_link(project.id, task.id),
            project_id=project.id,
            task_id=task.id,
        )
    await session.commit()
