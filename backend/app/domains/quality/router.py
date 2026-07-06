from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domains.auth.router import admin_user, current_user
from app.domains.quality import service
from app.domains.quality.schemas import QualitySettingsOut, QualitySettingsUpdate

router = APIRouter()


@router.get("/default", response_model=QualitySettingsOut)
def get_default_quality_settings(
    db: Session = Depends(get_db),
    _: object = Depends(current_user),
) -> QualitySettingsOut:
    return service.get_default_quality_settings(db)


@router.put("/default", response_model=QualitySettingsOut)
def update_default_quality_settings(
    payload: QualitySettingsUpdate,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> QualitySettingsOut:
    return service.update_default_quality_settings(db, payload.settings)


@router.post("/default/reset", response_model=QualitySettingsOut)
def reset_default_quality_settings(
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> QualitySettingsOut:
    return service.reset_default_quality_settings(db)
