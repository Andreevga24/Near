"""Зависимости FastAPI для проверки прав."""

from fastapi import Depends, HTTPException, status

from app.auth.manager import current_active_user
from app.models.user import User


async def require_superuser(user: User = Depends(current_active_user)) -> User:
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    return user
