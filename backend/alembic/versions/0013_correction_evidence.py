"""Add evidence_reference to correction_audits

Revision ID: 0013_correction_evidence
Revises: 0012_user_preferences
Create Date: 2026-11-28
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_correction_evidence"
down_revision: Union[str, None] = "0012_user_preferences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _column_exists("correction_audits", "evidence_reference"):
        op.add_column("correction_audits", sa.Column("evidence_reference", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _column_exists("correction_audits", "evidence_reference"):
        op.drop_column("correction_audits", "evidence_reference")
