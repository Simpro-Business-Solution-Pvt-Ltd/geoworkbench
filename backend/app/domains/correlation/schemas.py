from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CorrelationObservationCreate(BaseModel):
    borehole_ids: list[int] = Field(min_length=1)
    text: str = Field(min_length=1, max_length=4000)
    observation_metadata: dict | None = None


class CorrelationObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    correlation_key: str
    borehole_ids: list[int]
    text: str
    created_by: str
    created_at: datetime
    observation_metadata: dict | None = None
