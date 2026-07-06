from datetime import datetime

from pydantic import BaseModel


class QualitySettingsOut(BaseModel):
    key: str
    settings: dict
    updated_at: datetime | None = None


class QualitySettingsUpdate(BaseModel):
    settings: dict
