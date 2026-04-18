"""
Базовый класс моделей SQLAlchemy 2.0.
Все ORM-модели наследуются от него.
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """База для declarative-моделей."""

    pass
