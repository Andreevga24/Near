"""Разрешение email → зарегистрированный пользователь."""

from uuid import UUID

from pydantic import BaseModel


class ResolvedEmailRead(BaseModel):
    email: str
    user_id: UUID
