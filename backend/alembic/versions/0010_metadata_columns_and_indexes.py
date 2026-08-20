"""metadata columns and depth indexes

Revision ID: 0010_metadata_columns_and_indexes
Revises: 0009_quality_settings
Create Date: 2026-07-06
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0010_metadata_columns_and_indexes"
down_revision: Union[str, None] = "0009_quality_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name: str, column: sa.Column) -> None:
    if not _column_exists(table_name, column.name):
        op.add_column(table_name, column)


def upgrade() -> None:
    _add_column_if_missing("lithology_intervals", sa.Column("attributes", sa.JSON(), nullable=True))
    _add_column_if_missing("seam_intervals", sa.Column("attributes", sa.JSON(), nullable=True))
    _add_column_if_missing("curves", sa.Column("curve_metadata", sa.JSON(), nullable=True))
    _add_column_if_missing("core_images", sa.Column("image_metadata", sa.JSON(), nullable=True))

    _add_column_if_missing("users", sa.Column("email", sa.String(length=160), nullable=True))
    _add_column_if_missing(
        "users",
        sa.Column(
            "auth_provider",
            sa.String(length=40),
            nullable=False,
            server_default="local",
        ),
    )
    _add_column_if_missing(
        "users",
        sa.Column(
            "failed_login_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )
    _add_column_if_missing(
        "users",
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )
    _add_column_if_missing(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute("CREATE INDEX IF NOT EXISTS ix_users_email ON users (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_users_auth_provider ON users (auth_provider)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_lithology_borehole_depth "
        "ON lithology_intervals (borehole_id, from_depth, to_depth)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_seam_borehole_depth "
        "ON seam_intervals (borehole_id, from_depth, to_depth)"
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_curves_borehole_key ON curves (borehole_id, key)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_curve_samples_curve_depth "
        "ON curve_samples (curve_id, depth)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_core_images_borehole_depth "
        "ON core_images (borehole_id, from_depth, to_depth)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_core_images_borehole_depth")
    op.execute("DROP INDEX IF EXISTS ix_curve_samples_curve_depth")
    op.execute("DROP INDEX IF EXISTS ix_curves_borehole_key")
    op.execute("DROP INDEX IF EXISTS ix_seam_borehole_depth")
    op.execute("DROP INDEX IF EXISTS ix_lithology_borehole_depth")
    op.execute("DROP INDEX IF EXISTS ix_users_auth_provider")
    op.execute("DROP INDEX IF EXISTS ix_users_email")

    for table_name, column_name in [
        ("users", "last_login_at"),
        ("users", "locked_until"),
        ("users", "failed_login_count"),
        ("users", "auth_provider"),
        ("users", "email"),
        ("core_images", "image_metadata"),
        ("curves", "curve_metadata"),
        ("seam_intervals", "attributes"),
        ("lithology_intervals", "attributes"),
    ]:
        if _column_exists(table_name, column_name):
            op.drop_column(table_name, column_name)
