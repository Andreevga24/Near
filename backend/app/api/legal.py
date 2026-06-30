"""Согласия, экспорт и удаление аккаунта."""

from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi_users import exceptions as fu_exceptions
from fastapi_users.manager import BaseUserManager
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.manager import UserManager, current_active_user, get_user_manager
from app.db.session import get_async_session
from app.legal.constants import (
    CONSENT_VERSION,
    PRIVACY_VERSION,
    TERMS_VERSION,
    operator_email,
    operator_name,
)
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.models.user_consent_log import UserConsentLog
from app.models.user_notification import UserNotification
from app.models.user_workspace_store import UserWorkspaceStore
from app.schemas.legal import DeleteAccountBody, LegalMetaRead, RegisterWithConsent
from app.schemas.user import UserCreate, UserRead

router = APIRouter(tags=["legal", "account"])


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    if request.client:
        return request.client.host[:64]
    return None


def _validate_document_versions(privacy_version: str, terms_version: str) -> None:
    if privacy_version != PRIVACY_VERSION or terms_version != TERMS_VERSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Устаревшая версия юридических документов. Обновите страницу и примите актуальные условия.",
        )


async def _log_consent(
    session: AsyncSession,
    user_id: UUID,
    event_type: str,
    privacy_version: str,
    terms_version: str,
    ip_address: str | None,
) -> None:
    session.add(
        UserConsentLog(
            user_id=user_id,
            event_type=event_type,
            privacy_version=privacy_version,
            terms_version=terms_version,
            ip_address=ip_address,
        ),
    )


@router.get("/legal/meta", response_model=LegalMetaRead)
async def legal_meta() -> LegalMetaRead:
    return LegalMetaRead(
        privacy_version=PRIVACY_VERSION,
        terms_version=TERMS_VERSION,
        consent_version=CONSENT_VERSION,
        operator_name=operator_name(),
        operator_email=operator_email(),
    )


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register_with_consent(
    body: RegisterWithConsent,
    request: Request,
    user_manager: UserManager = Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    _validate_document_versions(body.privacy_version, body.terms_version)
    try:
        user = await user_manager.create(
            UserCreate(email=body.email, password=body.password),
            safe=True,
            request=request,
        )
    except fu_exceptions.UserAlreadyExists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Не удалось зарегистрировать аккаунт. Проверьте email и пароль.",
        ) from None
    except fu_exceptions.InvalidPasswordException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc

    await _log_consent(
        session,
        user.id,
        "registration",
        body.privacy_version,
        body.terms_version,
        _client_ip(request),
    )
    await session.commit()
    return user


@router.get("/account/export")
async def export_account_data(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    owned = await session.execute(select(Project).where(Project.owner_id == user.id))
    owned_projects = [
        {"id": str(p.id), "name": p.name, "kind": p.kind, "created_at": p.created_at.isoformat()}
        for p in owned.scalars().all()
    ]

    memberships = await session.execute(
        select(ProjectMember, Project.name)
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == user.id),
    )
    member_of = [
        {"project_id": str(row[0].project_id), "project_name": row[1], "role": row[0].role}
        for row in memberships.all()
    ]

    stores = await session.execute(
        select(UserWorkspaceStore).where(UserWorkspaceStore.user_id == user.id),
    )
    workspace: dict[str, object] = {}
    for store in stores.scalars().all():
        try:
            workspace[store.store_key] = json.loads(store.data or "{}")
        except json.JSONDecodeError:
            workspace[store.store_key] = store.data

    notif_count = await session.execute(
        select(UserNotification.id).where(UserNotification.user_id == user.id),
    )
    tickets = await session.execute(
        select(SupportTicket).where(SupportTicket.user_id == user.id),
    )

    payload = {
        "exported_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "user": {
            "id": str(user.id),
            "email": user.email,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        },
        "workspace_stores": workspace,
        "owned_projects": owned_projects,
        "project_memberships": member_of,
        "notifications_count": len(notif_count.all()),
        "support_tickets": [
            {
                "id": str(t.id),
                "subject": t.subject,
                "status": t.status,
                "created_at": t.created_at.isoformat(),
            }
            for t in tickets.scalars().all()
        ],
        "note": "Полный экспорт задач и комментариев доступен в проектах, где вы участник. "
        "При удалении аккаунта проекты, где вы владелец, будут удалены вместе с задачами.",
    }

    content = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    return Response(
        content=content,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="near-data-export.json"'},
    )


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    body: DeleteAccountBody,
    request: Request,
    user: User = Depends(current_active_user),
    user_manager: BaseUserManager[User, UUID] = Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    valid, _ = user_manager.password_helper.verify_and_update(body.password, user.hashed_password)
    if not valid:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Неверный пароль")

    await user_manager.delete(user, request=request)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
