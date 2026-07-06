from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import Borehole, Curve
from app.db.session import get_db
from app.domains.boreholes.schemas import ValidationIssueOut
from app.domains.quality.service import get_quality_settings_payload
from app.services.validation.borehole_validation import replace_validation_issues, validate_borehole

router = APIRouter()


@router.post("/boreholes/{borehole_id}/run", response_model=list[ValidationIssueOut])
def run_borehole_validation(
    borehole_id: int, db: Session = Depends(get_db)
) -> list[ValidationIssueOut]:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.validation_issues),
            selectinload(Borehole.curves).selectinload(Curve.samples),
            selectinload(Borehole.core_images),
        )
    )
    if borehole is None:
        raise HTTPException(status_code=404, detail="Borehole not found")

    replace_validation_issues(borehole, validate_borehole(borehole, get_quality_settings_payload(db)))
    db.commit()
    db.refresh(borehole)
    return sorted(
        borehole.validation_issues,
        key=lambda item: (
            {"error": 0, "warning": 1, "info": 2}.get(item.severity, 3),
            item.from_depth if item.from_depth is not None else -1,
        ),
    )
