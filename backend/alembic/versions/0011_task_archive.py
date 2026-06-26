"""Add task archive fields (closed_at, completed).

Revision ID: 0011_task_archive
Revises: 0010_user_workspace_stores
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011_task_archive"
down_revision: Union[str, None] = "0010_user_workspace_stores"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("completed", sa.Boolean(), nullable=True))
        batch.create_index(batch.f("ix_tasks_closed_at"), ["closed_at"], unique=False)


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_index(batch.f("ix_tasks_closed_at"))
        batch.drop_column("completed")
        batch.drop_column("closed_at")
