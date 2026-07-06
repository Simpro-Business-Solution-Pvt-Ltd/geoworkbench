from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import QualitySettings
from app.services.quality_config import DEFAULT_QUALITY_SETTINGS, normalize_quality_settings


DEFAULT_QUALITY_SETTINGS_KEY = "default"


def _serialize(row: QualitySettings) -> dict:
    return {
        "key": row.key,
        "settings": normalize_quality_settings(row.settings),
        "updated_at": row.updated_at,
    }


def get_default_quality_settings(db: Session) -> dict:
    row = db.scalar(select(QualitySettings).where(QualitySettings.key == DEFAULT_QUALITY_SETTINGS_KEY))
    if row is None:
        row = QualitySettings(
            key=DEFAULT_QUALITY_SETTINGS_KEY,
            settings=normalize_quality_settings(DEFAULT_QUALITY_SETTINGS),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return _serialize(row)


def update_default_quality_settings(db: Session, settings: dict) -> dict:
    row = db.scalar(select(QualitySettings).where(QualitySettings.key == DEFAULT_QUALITY_SETTINGS_KEY))
    if row is None:
        row = QualitySettings(key=DEFAULT_QUALITY_SETTINGS_KEY, settings={})
    row.settings = normalize_quality_settings(settings)
    row.updated_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


def reset_default_quality_settings(db: Session) -> dict:
    return update_default_quality_settings(db, DEFAULT_QUALITY_SETTINGS)


def get_quality_settings_payload(db: Session) -> dict:
    return get_default_quality_settings(db)["settings"]
