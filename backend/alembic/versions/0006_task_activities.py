"""Add task_activities for task timeline.

Revision ID: 0006_task_activities
Revises: 0005_task_focus_fields
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_task_activities"
down_revision: Union[str, None] = "0005_task_focus_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_type():
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        return postgresql.UUID(as_uuid=True)
    return sa.CHAR(length=36)


def _ts_default():
    return sa.text("CURRENT_TIMESTAMP")


def upgrade() -> None:
    uid = _uuid_type()
    op.create_table(
        "task_activities",
        sa.Column("id", uid, nullable=False),
        sa.Column("task_id", uid, nullable=False),
        sa.Column("actor_id", uid, nullable=True),
        sa.Column("type", sa.String(length=48), nullable=False),
        sa.Column("data", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_ts_default(), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_task_activities_task_id"), "task_activities", ["task_id"], unique=False)
    op.create_index(op.f("ix_task_activities_actor_id"), "task_activities", ["actor_id"], unique=False)
    op.create_index(op.f("ix_task_activities_type"), "task_activities", ["type"], unique=False)
    op.create_index(op.f("ix_task_activities_created_at"), "task_activities", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_activities_created_at"), table_name="task_activities")
    op.drop_index(op.f("ix_task_activities_type"), table_name="task_activities")
    op.drop_index(op.f("ix_task_activities_actor_id"), table_name="task_activities")
    op.drop_index(op.f("ix_task_activities_task_id"), table_name="task_activities")
    op.drop_table("task_activities")

