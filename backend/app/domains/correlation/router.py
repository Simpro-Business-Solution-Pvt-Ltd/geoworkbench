from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domains.auth import service as auth_service
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
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> CorrelationObservationOut:
    try:
        return service.create_observation(
            db,
            payload,
            created_by=_username_from_authorization(db, authorization),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _username_from_authorization(db: Session, authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        return "demo-user"
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return "demo-user"
    try:
        user, _ = auth_service.get_session(db, token)
    except ValueError:
        return "demo-user"
    return user.username


def _parse_borehole_ids(raw: str) -> list[int]:
    try:
        return [int(item.strip()) for item in raw.split(",") if item.strip()]
    except ValueError as exc:
        raise ValueError("borehole_ids must be comma separated integers") from exc
