"""Add user workspace stores.

Revision ID: 0010_user_workspace_stores
Revises: 0009_public_share_links
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010_user_workspace_stores"
down_revision: Union[str, None] = "0009_public_share_links"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_workspace_stores",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("store_key", sa.String(length=32), nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "store_key", name="uq_user_workspace_store"),
    )
    op.create_index(op.f("ix_user_workspace_stores_store_key"), "user_workspace_stores", ["store_key"], unique=False)
    op.create_index(op.f("ix_user_workspace_stores_user_id"), "user_workspace_stores", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_workspace_stores_user_id"), table_name="user_workspace_stores")
    op.drop_index(op.f("ix_user_workspace_stores_store_key"), table_name="user_workspace_stores")
    op.drop_table("user_workspace_stores")
