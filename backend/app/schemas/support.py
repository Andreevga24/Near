"""Схемы тикетов поддержки."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class SupportTicketCreate(BaseModel):
    subject: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1)
    status: str = Field(default="open", pattern="^(draft|open)$")


class SupportTicketUpdate(BaseModel):
    subject: str | None = Field(default=None, min_length=1, max_length=500)
    body: str | None = Field(default=None, min_length=1)
    status: str | None = Field(default=None, pattern="^(draft|open|in_progress|resolved|closed)$")


class SupportTicketReplyCreate(BaseModel):
    body: str = Field(min_length=1)


class SupportTicketReplyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    ticket_id: UUID
    user_id: UUID
    author_email: str
    body: str
    created_at: datetime


class SupportTicketRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subject: str
    body: str
    email: str
    status: str
    created_at: datetime
    updated_at: datetime
    reply_count: int = 0


class SupportTicketDetailRead(SupportTicketRead):
    replies: list[SupportTicketReplyRead] = Field(default_factory=list)
