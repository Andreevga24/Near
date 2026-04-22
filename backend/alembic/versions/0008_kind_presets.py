"""Add kind_presets for scenario template overrides.

Revision ID: 0008_kind_presets
Revises: 0007_task_checklist_items
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_kind_presets"
down_revision: Union[str, None] = "0007_task_checklist_items"
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
        "kind_presets",
        sa.Column("id", uid, nullable=False),
        sa.Column("kind", sa.String(length=40), nullable=False),
        sa.Column("column_hints_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("default_checklists_json", sa.Text(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=_ts_default(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("kind", name="uq_kind_presets_kind"),
    )
    op.create_index(op.f("ix_kind_presets_kind"), "kind_presets", ["kind"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_kind_presets_kind"), table_name="kind_presets")
    op.drop_table("kind_presets")

