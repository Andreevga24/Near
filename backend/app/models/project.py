"""
Проект — контейнер для задач (канбан-доска привязана к проекту).
"""

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Project(Base):
    """Проект в системе Near."""

    __tablename__ = "projects"

    id: Mapped[UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid4,
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str] = mapped_column(String(40), default="general", index=True)

    # Публичный read-only доступ по ссылке (случайный идентификатор).
    share_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    owner_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    owner: Mapped["User"] = relationship(
        back_populates="owned_projects",
        foreign_keys=[owner_id],
    )
    tasks: Mapped[list["Task"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )

    task_links: Mapped[list["TaskLink"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
    )
