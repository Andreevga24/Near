"""Добавить projects.kind — сценарий доски."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_project_kind"
down_revision: Union[str, None] = "0001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("kind", sa.String(length=40), nullable=False, server_default="general"),
    )
    op.create_index(op.f("ix_projects_kind"), "projects", ["kind"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_projects_kind"), table_name="projects")
    op.drop_column("projects", "kind")
