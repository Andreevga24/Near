"""Историческая ревизия: projects.kind.

В ранних итерациях проекта ревизия называлась `0003_project_kind` и могла быть уже
применена в локальной БД. Этот файл сохраняет совместимость истории Alembic.

Revision ID: 0003_project_kind
Revises: 0002_project_kind
Create Date: 2026-04-22
"""

from typing import Sequence, Union

revision: str = "0003_project_kind"
down_revision: Union[str, None] = "0002_project_kind"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # no-op: поле kind уже добавлено ревизией 0002_project_kind
    pass


def downgrade() -> None:
    # no-op
    pass

