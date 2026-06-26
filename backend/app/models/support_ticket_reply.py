"""
Ответ в тикете поддержки.
"""

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SupportTicketReply(Base):
    __tablename__ = "support_ticket_replies"

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)
    ticket_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("support_tickets.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    ticket: Mapped["SupportTicket"] = relationship(back_populates="replies")
    user: Mapped["User"] = relationship(back_populates="support_ticket_replies")
