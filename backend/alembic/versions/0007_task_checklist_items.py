"""Add task_checklist_items for scenario presets.

Revision ID: 0007_task_checklist_items
Revises: 0006_task_activities
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_task_checklist_items"
down_revision: Union[str, None] = "0006_task_activities"
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
        "task_checklist_items",
        sa.Column("id", uid, nullable=False),
        sa.Column("task_id", uid, nullable=False),
        sa.Column("text", sa.String(length=5000), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_ts_default(), nullable=False),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("task_id", "position", name="uq_task_checklist_task_position"),
    )
    op.create_index(op.f("ix_task_checklist_items_task_id"), "task_checklist_items", ["task_id"], unique=False)
    op.create_index(op.f("ix_task_checklist_items_is_done"), "task_checklist_items", ["is_done"], unique=False)
    op.create_index(op.f("ix_task_checklist_items_position"), "task_checklist_items", ["position"], unique=False)

    with op.batch_alter_table("task_checklist_items") as batch:
        batch.alter_column("is_done", server_default=None)
        batch.alter_column("position", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_checklist_items_position"), table_name="task_checklist_items")
    op.drop_index(op.f("ix_task_checklist_items_is_done"), table_name="task_checklist_items")
    op.drop_index(op.f("ix_task_checklist_items_task_id"), table_name="task_checklist_items")
    op.drop_table("task_checklist_items")

