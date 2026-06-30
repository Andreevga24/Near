"""User consent audit log for 152-FZ.

Revision ID: 0017_user_consent_logs
Revises: 0016_task_time_entries
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_user_consent_logs"
down_revision: Union[str, None] = "0016_task_time_entries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_consent_logs",
        sa.Column("id", sa.CHAR(36), nullable=False),
        sa.Column("user_id", sa.CHAR(36), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("privacy_version", sa.String(length=32), nullable=False),
        sa.Column("terms_version", sa.String(length=32), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_consent_logs_user_id"), "user_consent_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_consent_logs_created_at"), "user_consent_logs", ["created_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_consent_logs_created_at"), table_name="user_consent_logs")
    op.drop_index(op.f("ix_user_consent_logs_user_id"), table_name="user_consent_logs")
    op.drop_table("user_consent_logs")
