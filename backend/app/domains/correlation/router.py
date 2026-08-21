from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domains.correlation import service
from app.domains.correlation.schemas import CorrelationObservationCreate, CorrelationObservationOut

router = APIRouter()


@router.get("/observations", response_model=list[CorrelationObservationOut])
def list_correlation_observations(
    borehole_ids: str = Query(..., description="Comma separated borehole ids in the current correlation set."),
    db: Session = Depends(get_db),
) -> list[CorrelationObservationOut]:
    try:
        ids = _parse_borehole_ids(borehole_ids)
        return service.list_observations(db, ids)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/observations", response_model=CorrelationObservationOut)
def create_correlation_observation(
    payload: CorrelationObservationCreate,
    db: Session = Depends(get_db),
) -> CorrelationObservationOut:
    try:
        return service.create_observation(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _parse_borehole_ids(raw: str) -> list[int]:
    try:
        return [int(item.strip()) for item in raw.split(",") if item.strip()]
    except ValueError as exc:
        raise ValueError("borehole_ids must be comma separated integers") from exc
