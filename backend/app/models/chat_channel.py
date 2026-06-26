"""
Канал мессенджера: личный, по проекту или по задаче.
"""

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChatChannel(Base):
    __tablename__ = "chat_channels"

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)
    created_by_user_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    project_id: Mapped[UUID | None] = mapped_column(
        GUID,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    task_id: Mapped[UUID | None] = mapped_column(
        GUID,
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    created_by: Mapped["User"] = relationship(back_populates="chat_channels_created")
    project: Mapped["Project | None"] = relationship()
    task: Mapped["Task | None"] = relationship()
    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="channel",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
    )
