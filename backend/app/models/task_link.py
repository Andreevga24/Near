"""
Связи задач внутри одного проекта: блокировки и связанные задачи.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TaskLink(Base):
    """Связь между двумя задачами одного проекта."""

    __tablename__ = "task_links"
    __table_args__ = (
        UniqueConstraint("from_task_id", "to_task_id", "type", name="uq_task_links_from_to_type"),
    )

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)

    project_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("projects.id", ondelete="CASCADE"),
        index=True,
    )

    from_task_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
    )
    to_task_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
    )

    # blocks: направленная A -> B (A блокирует B)
    # relates: тоже храним направленно (создаём две записи A->B и B->A)
    type: Mapped[str] = mapped_column(String(16), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    project: Mapped["Project"] = relationship(back_populates="task_links")
    from_task: Mapped["Task"] = relationship(foreign_keys=[from_task_id])
    to_task: Mapped["Task"] = relationship(foreign_keys=[to_task_id])

