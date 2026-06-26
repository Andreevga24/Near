"""Task time tracking entries.

Revision ID: 0016_task_time_entries
Revises: 0015_project_share_v2
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_task_time_entries"
down_revision: Union[str, None] = "0015_project_share_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "task_time_entries",
        sa.Column("id", sa.CHAR(36), nullable=False),
        sa.Column("task_id", sa.CHAR(36), nullable=False),
        sa.Column("user_id", sa.CHAR(36), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("stopped_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_time_entries_task_id"), "task_time_entries", ["task_id"], unique=False)
    op.create_index(op.f("ix_task_time_entries_user_id"), "task_time_entries", ["user_id"], unique=False)
    op.create_index(op.f("ix_task_time_entries_started_at"), "task_time_entries", ["started_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_time_entries_started_at"), table_name="task_time_entries")
    op.drop_index(op.f("ix_task_time_entries_user_id"), table_name="task_time_entries")
    op.drop_index(op.f("ix_task_time_entries_task_id"), table_name="task_time_entries")
    op.drop_table("task_time_entries")
