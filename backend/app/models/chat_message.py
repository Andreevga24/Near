"""
Сообщение в канале мессенджера.
"""

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)
    channel_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("chat_channels.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
    )

    channel: Mapped["ChatChannel"] = relationship(back_populates="messages")
    user: Mapped["User"] = relationship(back_populates="chat_messages")
