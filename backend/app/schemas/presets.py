"""
Схемы сценарных пресетов по kind (подсказки колонок и дефолтные чеклисты).
"""

from pydantic import BaseModel, Field


class KindPresetRead(BaseModel):
    kind: str
    column_hints: dict[str, str] = {}
    default_checklists: dict[str, list[str]] = {}


class KindPresetUpsert(BaseModel):
    column_hints: dict[str, str] = Field(default_factory=dict)
    default_checklists: dict[str, list[str]] = Field(default_factory=dict)

