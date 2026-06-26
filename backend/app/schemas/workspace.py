"""
Схемы персонального workspace-хранилища.
"""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


WORKSPACE_STORE_KEYS = frozenset({"company", "messenger", "support", "profile"})


class WorkspaceStoreRead(BaseModel):
    store_key: str
    data: dict[str, Any] | None = None
    updated_at: datetime | None = None


class WorkspaceStoreUpsert(BaseModel):
    data: dict[str, Any] = Field(default_factory=dict)
