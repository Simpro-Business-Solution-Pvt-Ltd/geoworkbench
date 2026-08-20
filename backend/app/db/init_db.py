from app.db import models  # noqa: F401
from app.db.session import Base, engine
from sqlalchemy import inspect, text


USER_COLUMN_DEFAULTS = {
    "email": "VARCHAR(160)",
    "auth_provider": "VARCHAR(40) DEFAULT 'local'",
    "failed_login_count": "INTEGER DEFAULT 0",
    "locked_until": "TIMESTAMP NULL",
    "last_login_at": "TIMESTAMP NULL",
}

EXTENSION_COLUMN_DEFAULTS = {
    "boreholes": {"attributes": "JSON NULL"},
    "lithology_intervals": {"attributes": "JSON NULL"},
    "seam_intervals": {"attributes": "JSON NULL"},
    "curves": {"curve_metadata": "JSON NULL"},
    "core_images": {"image_metadata": "JSON NULL"},
}

DEPTH_SERIES_INDEXES = {
    "ix_lithology_borehole_depth": "lithology_intervals (borehole_id, from_depth, to_depth)",
    "ix_seam_borehole_depth": "seam_intervals (borehole_id, from_depth, to_depth)",
    "ix_curves_borehole_key": "curves (borehole_id, key)",
    "ix_curve_samples_curve_depth": "curve_samples (curve_id, depth)",
    "ix_core_images_borehole_depth": "core_images (borehole_id, from_depth, to_depth)",
}


def _ensure_user_columns() -> None:
    inspector = inspect(engine)
    existing = {column["name"] for column in inspector.get_columns("users")}
    missing = [(name, ddl) for name, ddl in USER_COLUMN_DEFAULTS.items() if name not in existing]
    if not missing:
        return
    with engine.begin() as connection:
        for name, ddl in missing:
                connection.execute(text(f"ALTER TABLE users ADD COLUMN {name} {ddl}"))


def _ensure_extension_columns() -> None:
    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in EXTENSION_COLUMN_DEFAULTS.items():
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for name, ddl in columns.items():
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {name} {ddl}"))


def _ensure_depth_series_indexes() -> None:
    inspector = inspect(engine)
    existing = {
        index["name"]
        for table_name in EXTENSION_COLUMN_DEFAULTS.keys() | {"curve_samples"}
        for index in inspector.get_indexes(table_name)
    }
    with engine.begin() as connection:
        for name, target in DEPTH_SERIES_INDEXES.items():
            if name not in existing:
                connection.execute(text(f"CREATE INDEX {name} ON {target}"))


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_user_columns()
    _ensure_extension_columns()
    _ensure_depth_series_indexes()
