"""Field submission idempotency and device capture metadata

Adds client_submission_id (stable outbox item id for idempotent replay of
interrupted or repeated syncs) plus device_captured_at / device_timezone so
field data keeps the device capture time and timezone alongside the server
receipt time (submitted_at).

Revision ID: 0013_field_submission_idempotency
Revises: 0012_user_preferences
Create Date: 2026-11-25
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0013_field_submission_idempotency"
down_revision: Union[str, None] = "0012_user_preferences"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _index_exists(index_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return index_name in {index["name"] for index in inspector.get_indexes("field_submissions")}


def upgrade() -> None:
    if not _column_exists("field_submissions", "client_submission_id"):
        op.add_column(
            "field_submissions", sa.Column("client_submission_id", sa.String(160), nullable=True)
        )
    if not _column_exists("field_submissions", "device_captured_at"):
        op.add_column(
            "field_submissions",
            sa.Column("device_captured_at", sa.DateTime(timezone=True), nullable=True),
        )
    if not _column_exists("field_submissions", "device_timezone"):
        op.add_column("field_submissions", sa.Column("device_timezone", sa.String(80), nullable=True))
    if not _index_exists("uq_field_submissions_borehole_client_id"):
        op.create_index(
            "uq_field_submissions_borehole_client_id",
            "field_submissions",
            ["borehole_id", "client_submission_id"],
            unique=True,
        )


def downgrade() -> None:
    if _index_exists("uq_field_submissions_borehole_client_id"):
        op.drop_index("uq_field_submissions_borehole_client_id", table_name="field_submissions")
    if _column_exists("field_submissions", "device_timezone"):
        op.drop_column("field_submissions", "device_timezone")
    if _column_exists("field_submissions", "device_captured_at"):
        op.drop_column("field_submissions", "device_captured_at")
    if _column_exists("field_submissions", "client_submission_id"):
        op.drop_column("field_submissions", "client_submission_id")
