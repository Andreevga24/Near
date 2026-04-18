"""
Комментарий к задаче.
"""

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Comment(Base):
    """Текстовый комментарий пользователя к задаче."""

    __tablename__ = "comments"

    id: Mapped[UUID] = mapped_column(
        GUID,
        primary_key=True,
        default=uuid4,
    )
    task_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        index=True,
    )
    author_id: Mapped[UUID | None] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    body: Mapped[str] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    task: Mapped["Task"] = relationship(back_populates="comments")
    author: Mapped["User | None"] = relationship(back_populates="comments")
