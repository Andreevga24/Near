"""Add task priority and due_at for focus mode.

Revision ID: 0005_task_focus_fields
Revises: 0004_task_links
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_task_focus_fields"
down_revision: Union[str, None] = "0004_task_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("priority", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("due_at", sa.DateTime(timezone=True), nullable=True))
        batch.create_index(batch.f("ix_tasks_priority"), ["priority"], unique=False)
        batch.create_index(batch.f("ix_tasks_due_at"), ["due_at"], unique=False)

    # remove server_default to keep schema clean (SQLite keeps it anyway; PG too)
    with op.batch_alter_table("tasks") as batch:
        batch.alter_column("priority", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.drop_index(batch.f("ix_tasks_due_at"))
        batch.drop_index(batch.f("ix_tasks_priority"))
        batch.drop_column("due_at")
        batch.drop_column("priority")

