"""User notifications table.

Revision ID: 0013_user_notifications
Revises: 0012_project_members
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013_user_notifications"
down_revision: Union[str, None] = "0012_project_members"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_notifications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("activity_id", sa.Uuid(), nullable=True),
        sa.Column("type", sa.String(length=48), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["activity_id"], ["task_activities.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_notifications_user_id"), "user_notifications", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_notifications_project_id"), "user_notifications", ["project_id"], unique=False)
    op.create_index(op.f("ix_user_notifications_task_id"), "user_notifications", ["task_id"], unique=False)
    op.create_index(op.f("ix_user_notifications_activity_id"), "user_notifications", ["activity_id"], unique=False)
    op.create_index(op.f("ix_user_notifications_type"), "user_notifications", ["type"], unique=False)
    op.create_index(op.f("ix_user_notifications_read_at"), "user_notifications", ["read_at"], unique=False)
    op.create_index(op.f("ix_user_notifications_created_at"), "user_notifications", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_notifications_created_at"), table_name="user_notifications")
    op.drop_index(op.f("ix_user_notifications_read_at"), table_name="user_notifications")
    op.drop_index(op.f("ix_user_notifications_type"), table_name="user_notifications")
    op.drop_index(op.f("ix_user_notifications_activity_id"), table_name="user_notifications")
    op.drop_index(op.f("ix_user_notifications_task_id"), table_name="user_notifications")
    op.drop_index(op.f("ix_user_notifications_project_id"), table_name="user_notifications")
    op.drop_index(op.f("ix_user_notifications_user_id"), table_name="user_notifications")
    op.drop_table("user_notifications")
