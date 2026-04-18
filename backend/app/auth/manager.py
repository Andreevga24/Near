"""
Менеджер пользователей FastAPI Users и JWT-backend.
"""

import logging
import uuid
from collections.abc import AsyncGenerator

from fastapi import Depends, Request
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin, models
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase

from app.auth.deps import get_user_db
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    """
    Бизнес-логика пользователей: хеширование пароля, валидация, хуки после регистрации.
    Секреты для сброса пароля и верификации email — пока те же, что и для JWT (дев).
    """

    reset_password_token_secret = settings.JWT_SECRET
    verification_token_secret = settings.JWT_SECRET

    async def on_after_register(
        self,
        user: User,
        request: Request | None = None,
    ) -> None:
        """После регистрации: сюда можно вынести отправку письма через Celery."""
        logger.info("Зарегистрирован пользователь %s", user.id)
        _ = request


async def get_user_manager(
    user_db: SQLAlchemyUserDatabase[User, uuid.UUID] = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)


# Транспорт: токен в заголовке Authorization: Bearer …
# tokenUrl — подсказка для Swagger UI (OAuth2 password flow)
bearer_transport = BearerTransport(tokenUrl="/login")


def get_jwt_strategy() -> JWTStrategy[models.UP, models.ID]:
    """Стратегия JWT: срок жизни и секрет подписи из настроек."""
    return JWTStrategy(
        secret=settings.JWT_SECRET,
        lifetime_seconds=settings.JWT_LIFETIME_SECONDS,
    )


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

# Зависимость: только активный пользователь
current_active_user = fastapi_users.current_user(active=True)
