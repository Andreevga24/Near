"""
Участники проекта и приглашения.
"""

import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.access import (
    ensure_assignee_in_project,
    get_owned_project_or_404,
    get_project_role_or_404,
    list_project_participant_user_ids,
)
from app.auth.manager import current_active_user
from app.constants.project_roles import ProjectRole
from app.db.session import get_async_session
from app.models.project import Project
from app.models.project_invite import ProjectInvite
from app.models.project_member import ProjectMember
from app.models.user import User
from app.schemas.project_member import (
    ColleagueRead,
    ProjectInviteAccept,
    ProjectInviteCreate,
    ProjectInviteCreated,
    ProjectInviteRead,
    ProjectMemberAdd,
    ProjectMemberRead,
    ProjectMemberRoleUpdate,
    ProjectMembersRead,
)

router = APIRouter(tags=["project-members"])

INVITE_TTL_DAYS = 7


async def _build_members_list(session: AsyncSession, project: Project) -> list[ProjectMemberRead]:
    owner_res = await session.execute(select(User).where(User.id == project.owner_id))
    owner = owner_res.scalar_one()
    out: list[ProjectMemberRead] = [
        ProjectMemberRead(
            user_id=owner.id,
            email=owner.email,
            role=ProjectRole.OWNER.value,
            is_owner=True,
            joined_at=project.created_at,
        ),
    ]
    res = await session.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(ProjectMember.project_id == project.id)
        .order_by(ProjectMember.created_at.asc()),
    )
    for member, user in res.all():
        out.append(
            ProjectMemberRead(
                user_id=user.id,
                email=user.email,
                role=member.role,
                is_owner=False,
                joined_at=member.created_at,
            ),
        )
    return out


@router.get("/projects/{project_id}/members", response_model=ProjectMembersRead)
async def list_project_members(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectMembersRead:
    project, _role = await get_project_role_or_404(session, user, project_id)
    members = await _build_members_list(session, project)
    return ProjectMembersRead(project_id=project.id, members=members)


@router.post("/projects/{project_id}/members", response_model=ProjectMemberRead, status_code=status.HTTP_201_CREATED)
async def add_project_member(
    project_id: UUID,
    payload: ProjectMemberAdd,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectMemberRead:
    project = await get_owned_project_or_404(session, user, project_id)
    try:
        role = payload.validated_role()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    email = payload.email.strip().lower()
    target_res = await session.execute(select(User).where(User.email == email))
    target = target_res.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Пользователь с таким email не зарегистрирован. Создайте приглашение.")
    if target.id == project.owner_id:
        raise HTTPException(status_code=400, detail="Владелец уже в проекте")
    existing = await session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == target.id,
        ),
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="Пользователь уже участник проекта")
    member = ProjectMember(project_id=project.id, user_id=target.id, role=role)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return ProjectMemberRead(
        user_id=target.id,
        email=target.email,
        role=member.role,
        is_owner=False,
        joined_at=member.created_at,
    )


@router.patch("/projects/{project_id}/members/{member_user_id}", response_model=ProjectMemberRead)
async def update_project_member_role(
    project_id: UUID,
    member_user_id: UUID,
    payload: ProjectMemberRoleUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectMemberRead:
    project = await get_owned_project_or_404(session, user, project_id)
    try:
        role = payload.validated_role()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if member_user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Нельзя менять роль владельца")
    res = await session.execute(
        select(ProjectMember, User)
        .join(User, ProjectMember.user_id == User.id)
        .where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == member_user_id,
        ),
    )
    row = res.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Участник не найден")
    member, target = row
    member.role = role
    await session.commit()
    await session.refresh(member)
    return ProjectMemberRead(
        user_id=target.id,
        email=target.email,
        role=member.role,
        is_owner=False,
        joined_at=member.created_at,
    )


@router.delete("/projects/{project_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_project_member(
    project_id: UUID,
    member_user_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    project = await get_owned_project_or_404(session, user, project_id)
    if member_user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить владельца")
    res = await session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == member_user_id,
        ),
    )
    member = res.scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=404, detail="Участник не найден")
    await session.delete(member)
    await session.commit()


@router.get("/projects/{project_id}/invites", response_model=list[ProjectInviteRead])
async def list_project_invites(
    project_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[ProjectInvite]:
    project = await get_owned_project_or_404(session, user, project_id)
    res = await session.execute(
        select(ProjectInvite)
        .where(ProjectInvite.project_id == project.id, ProjectInvite.accepted_at.is_(None))
        .order_by(ProjectInvite.created_at.desc()),
    )
    return list(res.scalars().all())


@router.post("/projects/{project_id}/invites", response_model=ProjectInviteCreated, status_code=status.HTTP_201_CREATED)
async def create_project_invite(
    project_id: UUID,
    payload: ProjectInviteCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectInviteCreated:
    project = await get_owned_project_or_404(session, user, project_id)
    try:
        role = payload.validated_role()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    email = payload.email.strip().lower()
    target_res = await session.execute(select(User).where(User.email == email))
    target = target_res.scalar_one_or_none()
    if target is not None:
        if target.id == project.owner_id:
            raise HTTPException(status_code=400, detail="Этот пользователь уже владелец проекта")
        existing = await session.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project.id,
                ProjectMember.user_id == target.id,
            ),
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=400, detail="Пользователь уже участник проекта")
    invite = ProjectInvite(
        project_id=project.id,
        email=email,
        role=role,
        token=secrets.token_urlsafe(32),
        created_by_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
    )
    session.add(invite)
    await session.commit()
    await session.refresh(invite)
    return ProjectInviteCreated(
        invite=ProjectInviteRead.model_validate(invite),
        accept_path=f"/invites/{invite.token}",
    )


@router.delete("/projects/{project_id}/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_project_invite(
    project_id: UUID,
    invite_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> None:
    project = await get_owned_project_or_404(session, user, project_id)
    res = await session.execute(
        select(ProjectInvite).where(
            ProjectInvite.id == invite_id,
            ProjectInvite.project_id == project.id,
        ),
    )
    invite = res.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    await session.delete(invite)
    await session.commit()


@router.post("/project-invites/accept", response_model=ProjectMemberRead)
async def accept_project_invite(
    payload: ProjectInviteAccept,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> ProjectMemberRead:
    res = await session.execute(
        select(ProjectInvite, Project)
        .join(Project, ProjectInvite.project_id == Project.id)
        .where(ProjectInvite.token == payload.token),
    )
    row = res.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Приглашение не найдено")
    invite, project = row
    if invite.accepted_at is not None:
        raise HTTPException(status_code=400, detail="Приглашение уже принято")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Срок приглашения истёк")
    if user.email.lower() != invite.email.lower():
        raise HTTPException(status_code=403, detail="Приглашение выдано на другой email")
    if user.id == project.owner_id:
        raise HTTPException(status_code=400, detail="Вы уже владелец этого проекта")
    existing = await session.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        ),
    )
    if existing.scalar_one_or_none() is not None:
        invite.accepted_at = datetime.now(timezone.utc)
        await session.commit()
        raise HTTPException(status_code=400, detail="Вы уже участник проекта")
    member = ProjectMember(project_id=project.id, user_id=user.id, role=invite.role)
    invite.accepted_at = datetime.now(timezone.utc)
    session.add(member)
    await session.commit()
    await session.refresh(member)
    return ProjectMemberRead(
        user_id=user.id,
        email=user.email,
        role=member.role,
        is_owner=False,
        joined_at=member.created_at,
    )


@router.get("/users/colleagues", response_model=list[ColleagueRead])
async def list_colleagues(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[ColleagueRead]:
    """Зарегистрированные пользователи из проектов, где есть текущий пользователь."""
    from app.api.access import list_accessible_project_ids

    project_ids = await list_accessible_project_ids(session, user)
    colleague_ids: set[UUID] = set()
    for pid in project_ids:
        for uid in await list_project_participant_user_ids(session, pid):
            if uid != user.id:
                colleague_ids.add(uid)
    if not colleague_ids:
        return []
    res = await session.execute(select(User).where(User.id.in_(colleague_ids)).order_by(User.email.asc()))
    return [ColleagueRead(id=u.id, email=u.email) for u in res.scalars().all()]
