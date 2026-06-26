"""Project share expiry and hidden public columns.

Revision ID: 0015_project_share_v2
Revises: 0014_workspace_v2
Create Date: 2026-06-26
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0015_project_share_v2"
down_revision: Union[str, None] = "0014_workspace_v2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("share_expires_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("public_hidden_columns", sa.Text(), nullable=True))
        batch.create_index(batch.f("ix_projects_share_expires_at"), ["share_expires_at"], unique=False)

    with op.batch_alter_table("kind_presets") as batch:
        batch.add_column(sa.Column("starter_tasks_json", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("kind_presets") as batch:
        batch.drop_column("starter_tasks_json")

    with op.batch_alter_table("projects") as batch:
        batch.drop_index(batch.f("ix_projects_share_expires_at"))
        batch.drop_column("public_hidden_columns")
        batch.drop_column("share_expires_at")
