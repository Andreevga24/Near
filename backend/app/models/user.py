"""
Пользователь: таблица совместима с FastAPI Users (UUID, email, пароль, флаги).
Дополнительно — created_at и связи с проектами / задачами / комментариями.
"""

from datetime import datetime

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(SQLAlchemyBaseUserTableUUID, Base):
    """
    ORM-модель пользователя.
    Базовые поля (id, email, hashed_password, is_*) приходят из SQLAlchemyBaseUserTableUUID.
    """

    # Таблица в БД — «users» (как в миграции Alembic), не дефолтное «user» из миксина
    __tablename__ = "users"

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    owned_projects: Mapped[list["Project"]] = relationship(back_populates="owner")
    assigned_tasks: Mapped[list["Task"]] = relationship(back_populates="assignee")
    comments: Mapped[list["Comment"]] = relationship(back_populates="author")
