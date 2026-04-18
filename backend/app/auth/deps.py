"""
Зависимости FastAPI Users: адаптер SQLAlchemy к хранилищу пользователей.
"""

from fastapi import Depends
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_async_session
from app.models.user import User


async def get_user_db(
    session: AsyncSession = Depends(get_async_session),
):
    """Выдаёт SQLAlchemyUserDatabase на время запроса (та же сессия, что и у роутера)."""
    yield SQLAlchemyUserDatabase(session, User)
