from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domains.exports import service
from app.domains.exports.schemas import (
    ExportJobOut,
    ExportProfileOut,
    ExportProfilePatch,
    ExportReadinessOut,
    ExportRequest,
)

router = APIRouter()


@router.get("/profiles", response_model=list[ExportProfileOut])
def list_export_profiles(db: Session = Depends(get_db)) -> list[ExportProfileOut]:
    return service.list_export_profiles(db)


@router.patch("/profiles/{profile_id}", response_model=ExportProfileOut)
def update_export_profile(
    profile_id: int, payload: ExportProfilePatch, db: Session = Depends(get_db)
) -> ExportProfileOut:
    try:
        return service.update_export_profile(
            db,
            profile_id,
            name=payload.name,
            description=payload.description,
            mapping=payload.mapping,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/boreholes/{borehole_id}/readiness", response_model=ExportReadinessOut)
def get_export_readiness(borehole_id: int, db: Session = Depends(get_db)) -> ExportReadinessOut:
    try:
        return service.export_readiness(db, borehole_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/boreholes/{borehole_id}/jobs", response_model=list[ExportJobOut])
def list_export_jobs(borehole_id: int, db: Session = Depends(get_db)) -> list[ExportJobOut]:
    return service.list_exports(db, borehole_id)


@router.post("/boreholes/{borehole_id}/jobs", response_model=ExportJobOut)
def create_export_job(
    borehole_id: int, payload: ExportRequest, db: Session = Depends(get_db)
) -> ExportJobOut:
    try:
        return service.create_export(
            db,
            borehole_id,
            payload.export_type,
            export_profile_id=payload.export_profile_id,
            export_settings={
                "stage": payload.stage,
                "from_depth": payload.from_depth,
                "to_depth": payload.to_depth,
                "sections": payload.sections,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/jobs/{export_job_id}/download")
def download_export_job(export_job_id: int, db: Session = Depends(get_db)) -> FileResponse:
    try:
        path = service.get_export_path(db, export_job_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")
    media_type = "text/csv"
    if path.suffix.lower() == ".xlsx":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif path.suffix.lower() == ".las":
        media_type = "text/plain"
    return FileResponse(path, filename=path.name, media_type=media_type)
