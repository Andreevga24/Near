"""
Роли участников проекта.
"""

from enum import Enum


class ProjectRole(str, Enum):
    """Уровень доступа к проекту (owner > editor > viewer)."""

    VIEWER = "viewer"
    EDITOR = "editor"
    OWNER = "owner"


ROLE_LEVEL: dict[ProjectRole, int] = {
    ProjectRole.VIEWER: 1,
    ProjectRole.EDITOR: 2,
    ProjectRole.OWNER: 3,
}

MEMBER_ROLES: frozenset[str] = frozenset({ProjectRole.EDITOR.value, ProjectRole.VIEWER.value})
