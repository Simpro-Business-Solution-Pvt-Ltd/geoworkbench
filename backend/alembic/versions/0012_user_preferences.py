"""Add user preferences

Revision ID: 0012_user_preferences
Revises: 0011_borehole_attributes
Create Date: 2026-08-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0012_user_preferences"
down_revision: Union[str, None] = "0011_borehole_attributes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _column_exists("users", "preferences"):
        op.add_column("users", sa.Column("preferences", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _column_exists("users", "preferences"):
        op.drop_column("users", "preferences")
