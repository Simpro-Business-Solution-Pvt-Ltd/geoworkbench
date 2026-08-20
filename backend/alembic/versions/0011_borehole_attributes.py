"""Add borehole attributes

Revision ID: 0011_borehole_attributes
Revises: 0010_metadata_columns_and_indexes
Create Date: 2026-08-20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0011_borehole_attributes"
down_revision: Union[str, None] = "0010_metadata_columns_and_indexes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _column_exists("boreholes", "attributes"):
        op.add_column("boreholes", sa.Column("attributes", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _column_exists("boreholes", "attributes"):
        op.drop_column("boreholes", "attributes")
