"""
Переопределения сценарных пресетов (подсказки колонок и дефолтные чеклисты) для Project.kind.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from fastapi_users_db_sqlalchemy.generics import GUID
from sqlalchemy import DateTime, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class KindPreset(Base):
    __tablename__ = "kind_presets"
    __table_args__ = (UniqueConstraint("kind", name="uq_kind_presets_kind"),)

    id: Mapped[UUID] = mapped_column(GUID, primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(40), index=True)

    # JSON strings
    column_hints_json: Mapped[str] = mapped_column(Text, default="{}")
    default_checklists_json: Mapped[str] = mapped_column(Text, default="{}")

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

