"""
Асинхронный движок и фабрика сессий (SQLite или PostgreSQL).
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import settings

_engine_kw: dict = {"echo": False}

if settings.is_sqlite:
    _engine_kw["poolclass"] = NullPool
else:
    _engine_kw["pool_pre_ping"] = True
    _engine_kw["pool_size"] = settings.DB_POOL_SIZE
    _engine_kw["max_overflow"] = settings.DB_MAX_OVERFLOW

engine = create_async_engine(settings.DATABASE_URL, **_engine_kw)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Зависимость FastAPI: одна сессия на HTTP-запрос."""
    async with AsyncSessionLocal() as session:
        yield session
