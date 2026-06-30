"""
Поиск зарегистрированных пользователей по email.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.user import User
from app.schemas.user_lookup import ResolvedEmailRead

router = APIRouter(tags=["users"])

MAX_EMAIL_LOOKUP = 20


@router.get("/users/resolve-emails", response_model=list[ResolvedEmailRead])
async def resolve_emails(
    emails: str = Query(..., description="Список email через запятую"),
    _user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[ResolvedEmailRead]:
    raw = [e.strip().lower() for e in emails.split(",") if e.strip()][:MAX_EMAIL_LOOKUP]
    if not raw:
        return []
    res = await session.execute(select(User).where(User.email.in_(raw)))
    found = {u.email.lower(): u for u in res.scalars().all()}
    return [ResolvedEmailRead(email=e, user_id=found[e].id) for e in raw if e in found]
