"""
События активности по задаче (таймлайн).
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TaskActivity(Base):
    __tablename__ = "task_activities"

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)

    task_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
    )
    actor_id: Mapped[UUID | None] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # тип события (строка)
    type: Mapped[str] = mapped_column(String(48), index=True)
    # JSON-данные (снимок события) как текст
    data: Mapped[str] = mapped_column(Text, default="{}")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    task: Mapped["Task"] = relationship()
    actor: Mapped["User | None"] = relationship()

