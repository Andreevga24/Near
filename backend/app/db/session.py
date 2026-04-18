"""
Асинхронный движок и фабрика сессий для работы с БД (SQLite по умолчанию).
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

_sqlite = "sqlite" in settings.DATABASE_URL

# Движок на весь процесс; для SQLite — NullPool, чтобы меньше ловить database is locked
_engine_kw: dict = {"echo": False}
if _sqlite:
    _engine_kw["poolclass"] = NullPool
else:
    _engine_kw["pool_pre_ping"] = True

engine = create_async_engine(settings.DATABASE_URL, **_engine_kw)

# Фабрика сессий для FastAPI-зависимостей и фоновых задач
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Зависимость FastAPI: одна сессия на HTTP-запрос.
    Commit/rollback выполняйте в сервисном слое или в эндпоинте.
    """
    async with AsyncSessionLocal() as session:
        yield session
