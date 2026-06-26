"""
Тикеты поддержки в БД.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.manager import current_active_user
from app.db.session import get_async_session
from app.models.support_ticket import SupportTicket
from app.models.support_ticket_reply import SupportTicketReply
from app.models.user import User
from app.schemas.support import (
    SupportTicketCreate,
    SupportTicketDetailRead,
    SupportTicketRead,
    SupportTicketReplyCreate,
    SupportTicketReplyRead,
    SupportTicketUpdate,
)

router = APIRouter(prefix="/support", tags=["support"])


def _ticket_to_read(ticket: SupportTicket, reply_count: int = 0) -> SupportTicketRead:
    return SupportTicketRead(
        id=ticket.id,
        subject=ticket.subject,
        body=ticket.body,
        email=ticket.email,
        status=ticket.status,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        reply_count=reply_count,
    )


@router.get("/tickets", response_model=list[SupportTicketRead])
async def list_tickets(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> list[SupportTicketRead]:
    res = await session.execute(
        select(SupportTicket, func.count(SupportTicketReply.id))
        .outerjoin(SupportTicketReply, SupportTicketReply.ticket_id == SupportTicket.id)
        .where(SupportTicket.user_id == user.id)
        .group_by(SupportTicket.id)
        .order_by(SupportTicket.created_at.desc()),
    )
    return [_ticket_to_read(t, int(cnt)) for t, cnt in res.all()]


@router.post("/tickets", response_model=SupportTicketRead, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: SupportTicketCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> SupportTicketRead:
    ticket = SupportTicket(
        user_id=user.id,
        subject=payload.subject.strip(),
        body=payload.body.strip(),
        email=user.email,
        status=payload.status,
    )
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return _ticket_to_read(ticket)


@router.get("/tickets/{ticket_id}", response_model=SupportTicketDetailRead)
async def get_ticket(
    ticket_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> SupportTicketDetailRead:
    res = await session.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.replies))
        .where(SupportTicket.id == ticket_id, SupportTicket.user_id == user.id),
    )
    ticket = res.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Обращение не найдено")
    replies = []
    for r in ticket.replies:
        author = await session.get(User, r.user_id)
        replies.append(
            SupportTicketReplyRead(
                id=r.id,
                ticket_id=r.ticket_id,
                user_id=r.user_id,
                author_email=author.email if author else "unknown",
                body=r.body,
                created_at=r.created_at,
            ),
        )
    base = _ticket_to_read(ticket, len(replies))
    return SupportTicketDetailRead(**base.model_dump(), replies=replies)


@router.patch("/tickets/{ticket_id}", response_model=SupportTicketRead)
async def update_ticket(
    ticket_id: UUID,
    payload: SupportTicketUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> SupportTicketRead:
    res = await session.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.user_id == user.id),
    )
    ticket = res.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Обращение не найдено")
    if payload.subject is not None:
        ticket.subject = payload.subject.strip()
    if payload.body is not None:
        ticket.body = payload.body.strip()
    if payload.status is not None:
        ticket.status = payload.status
    await session.commit()
    await session.refresh(ticket)
    cnt_res = await session.execute(
        select(func.count()).select_from(SupportTicketReply).where(SupportTicketReply.ticket_id == ticket.id),
    )
    return _ticket_to_read(ticket, int(cnt_res.scalar_one()))


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_ticket(
    ticket_id: UUID,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> Response:
    res = await session.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.user_id == user.id),
    )
    ticket = res.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Обращение не найдено")
    await session.delete(ticket)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tickets/{ticket_id}/replies", response_model=SupportTicketReplyRead, status_code=status.HTTP_201_CREATED)
async def add_reply(
    ticket_id: UUID,
    payload: SupportTicketReplyCreate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> SupportTicketReplyRead:
    res = await session.execute(
        select(SupportTicket).where(SupportTicket.id == ticket_id, SupportTicket.user_id == user.id),
    )
    ticket = res.scalar_one_or_none()
    if ticket is None:
        raise HTTPException(status_code=404, detail="Обращение не найдено")
    reply = SupportTicketReply(ticket_id=ticket.id, user_id=user.id, body=payload.body.strip())
    session.add(reply)
    if ticket.status == "open":
        ticket.status = "in_progress"
    await session.commit()
    await session.refresh(reply)
    return SupportTicketReplyRead(
        id=reply.id,
        ticket_id=reply.ticket_id,
        user_id=reply.user_id,
        author_email=user.email,
        body=reply.body,
        created_at=reply.created_at,
    )
