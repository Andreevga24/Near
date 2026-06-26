"""
Персональные данные workspace (компания, мессенджер, поддержка) на сервере.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserWorkspaceStore(Base):
    __tablename__ = "user_workspace_stores"
    __table_args__ = (UniqueConstraint("user_id", "store_key", name="uq_user_workspace_store"),)

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        GUID,
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    store_key: Mapped[str] = mapped_column(String(32), index=True)
    data: Mapped[str] = mapped_column(Text, default="{}")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
