"""
Схемы участников проекта и приглашений.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.constants.project_roles import MEMBER_ROLES


class ProjectMemberRead(BaseModel):
    user_id: UUID
    email: str
    role: str
    is_owner: bool = False
    joined_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectMembersRead(BaseModel):
    project_id: UUID
    members: list[ProjectMemberRead]


class ProjectMemberAdd(BaseModel):
    email: EmailStr
    role: str = Field(..., description="editor или viewer")

    def validated_role(self) -> str:
        role = self.role.strip().lower()
        if role not in MEMBER_ROLES:
            raise ValueError("role must be editor or viewer")
        return role


class ProjectMemberRoleUpdate(BaseModel):
    role: str = Field(..., description="editor или viewer")

    def validated_role(self) -> str:
        role = self.role.strip().lower()
        if role not in MEMBER_ROLES:
            raise ValueError("role must be editor or viewer")
        return role


class ProjectInviteCreate(BaseModel):
    email: EmailStr
    role: str = Field(default="editor", description="editor или viewer")

    def validated_role(self) -> str:
        role = self.role.strip().lower()
        if role not in MEMBER_ROLES:
            raise ValueError("role must be editor or viewer")
        return role


class ProjectInviteRead(BaseModel):
    id: UUID
    email: str
    role: str
    token: str
    expires_at: datetime
    accepted_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProjectInviteCreated(BaseModel):
    invite: ProjectInviteRead
    accept_path: str


class ProjectInviteAccept(BaseModel):
    token: str = Field(..., min_length=8, max_length=64)


class ColleagueRead(BaseModel):
    id: UUID
    email: str
