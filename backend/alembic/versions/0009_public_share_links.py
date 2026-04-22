"""Add project public share links.

Revision ID: 0009_public_share_links
Revises: 0008_kind_presets
Create Date: 2026-04-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009_public_share_links"
down_revision: Union[str, None] = "0008_kind_presets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("share_id", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("0")))
        batch.create_index(batch.f("ix_projects_share_id"), ["share_id"], unique=True)
        batch.create_index(batch.f("ix_projects_is_public"), ["is_public"], unique=False)

    with op.batch_alter_table("projects") as batch:
        batch.alter_column("is_public", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.drop_index(batch.f("ix_projects_is_public"))
        batch.drop_index(batch.f("ix_projects_share_id"))
        batch.drop_column("is_public")
        batch.drop_column("share_id")

