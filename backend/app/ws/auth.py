"""
Аутентификация WebSocket: JWT в query-параметре token=…
(браузерный WebSocket API не задаёт произвольные заголовки удобно).
"""

from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.manager import UserManager, get_jwt_strategy
from app.models.user import User


async def get_user_from_ws_token(session: AsyncSession, token: str) -> User | None:
    """
    Проверка JWT тем же алгоритмом, что и REST-login (FastAPI Users JWTStrategy).
    Возвращает активного пользователя из БД или None.
    """
    user_db = SQLAlchemyUserDatabase(session, User)
    user_manager = UserManager(user_db)
    strategy = get_jwt_strategy()
    user = await strategy.read_token(token, user_manager)
    if user is None or not user.is_active:
        return None
    return user
