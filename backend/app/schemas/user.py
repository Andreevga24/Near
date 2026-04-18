"""
Схемы пользователя для FastAPI Users (чтение / создание / обновление).
"""

import uuid
from datetime import datetime

from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    """Ответ API: профиль пользователя (включая дату регистрации)."""

    created_at: datetime


class UserCreate(schemas.BaseUserCreate):
    """Тело POST /register: email и пароль."""

    pass


class UserUpdate(schemas.BaseUserUpdate):
    """Частичное обновление пользователя (пригодится в личном кабинете)."""

    pass
