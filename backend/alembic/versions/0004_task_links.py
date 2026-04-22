"""Добавить task_links — связи задач (blocks/relates).

Revision ID: 0004_task_links
Revises: 0003_project_kind
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_task_links"
down_revision: Union[str, None] = "0003_project_kind"
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
        "task_links",
        sa.Column("id", uid, nullable=False),
        sa.Column("project_id", uid, nullable=False),
        sa.Column("from_task_id", uid, nullable=False),
        sa.Column("to_task_id", uid, nullable=False),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=_ts_default(), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["from_task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["to_task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("from_task_id", "to_task_id", "type", name="uq_task_links_from_to_type"),
    )
    op.create_index(op.f("ix_task_links_project_id"), "task_links", ["project_id"], unique=False)
    op.create_index(op.f("ix_task_links_from_task_id"), "task_links", ["from_task_id"], unique=False)
    op.create_index(op.f("ix_task_links_to_task_id"), "task_links", ["to_task_id"], unique=False)
    op.create_index(op.f("ix_task_links_type"), "task_links", ["type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_links_type"), table_name="task_links")
    op.drop_index(op.f("ix_task_links_to_task_id"), table_name="task_links")
    op.drop_index(op.f("ix_task_links_from_task_id"), table_name="task_links")
    op.drop_index(op.f("ix_task_links_project_id"), table_name="task_links")
    op.drop_table("task_links")

