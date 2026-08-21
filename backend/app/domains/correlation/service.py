from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CorrelationObservation
from app.domains.correlation.schemas import CorrelationObservationCreate


def correlation_key(borehole_ids: list[int]) -> str:
    ids = sorted({int(item) for item in borehole_ids if int(item) > 0})
    if not ids:
        raise ValueError("At least one borehole id is required")
    return ":".join(str(item) for item in ids)


def list_observations(db: Session, borehole_ids: list[int]) -> list[CorrelationObservation]:
    key = correlation_key(borehole_ids)
    return list(
        db.scalars(
            select(CorrelationObservation)
            .where(CorrelationObservation.correlation_key == key)
            .order_by(CorrelationObservation.created_at.desc(), CorrelationObservation.id.desc())
        )
    )


def create_observation(
    db: Session,
    payload: CorrelationObservationCreate,
    *,
    created_by: str = "demo-user",
) -> CorrelationObservation:
    key = correlation_key(payload.borehole_ids)
    observation = CorrelationObservation(
        correlation_key=key,
        borehole_ids=[int(item) for item in key.split(":")],
        text=payload.text.strip(),
        created_by=created_by,
        observation_metadata=payload.observation_metadata,
    )
    db.add(observation)
    db.commit()
    db.refresh(observation)
    return observation
