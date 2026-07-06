"""quality settings

Revision ID: 0009_quality_settings
Revises: 0008_local_auth
Create Date: 2026-07-06
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0009_quality_settings"
down_revision: Union[str, None] = "0008_local_auth"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "quality_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("key", sa.String(length=120), nullable=False),
        sa.Column("settings", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_quality_settings_key"), "quality_settings", ["key"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_quality_settings_key"), table_name="quality_settings")
    op.drop_table("quality_settings")
