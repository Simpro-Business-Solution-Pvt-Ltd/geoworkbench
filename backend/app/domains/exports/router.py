from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.realtime import publish_workbench_event
from app.db.session import get_db
from app.domains.exports import service
from app.domains.exports.schemas import (
    ExportJobOut,
    ExportProfileCreate,
    ExportProfileOut,
    ExportProfilePatch,
    ExportReadinessOut,
    ExportRequest,
    ExportSourceFieldOut,
)

router = APIRouter()


def _profile_out(profile) -> ExportProfileOut:
    out = ExportProfileOut.model_validate(profile)
    out.builtin = service.is_builtin_export_profile(profile)
    return out


@router.get("/profiles", response_model=list[ExportProfileOut])
def list_export_profiles(db: Session = Depends(get_db)) -> list[ExportProfileOut]:
    return [_profile_out(profile) for profile in service.list_export_profiles(db)]


@router.get("/profiles/source-fields", response_model=list[ExportSourceFieldOut])
def list_export_source_fields() -> list[dict]:
    return service.export_source_fields()


@router.post("/profiles", response_model=ExportProfileOut, status_code=201)
def create_export_profile(payload: ExportProfileCreate, db: Session = Depends(get_db)) -> ExportProfileOut:
    try:
        profile = service.create_export_profile(
            db,
            export_type=payload.export_type,
            name=payload.name,
            description=payload.description,
            mapping=payload.mapping,
        )
        publish_workbench_event(
            "workbench.export_profile.updated",
            borehole_id=None,
            entity="export_profile",
            operation="created",
            payload={"profile_id": profile.id, "export_type": profile.export_type},
        )
        return _profile_out(profile)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/profiles/{profile_id}", response_model=ExportProfileOut)
def update_export_profile(
    profile_id: int, payload: ExportProfilePatch, db: Session = Depends(get_db)
) -> ExportProfileOut:
    try:
        profile = service.update_export_profile(
            db,
            profile_id,
            name=payload.name,
            description=payload.description,
            mapping=payload.mapping,
        )
        publish_workbench_event(
            "workbench.export_profile.updated",
            borehole_id=None,
            entity="export_profile",
            operation="updated",
            payload={"profile_id": profile.id, "export_type": profile.export_type},
        )
        return _profile_out(profile)
    except service.ExportProfileNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except service.ExportProfileReadOnly as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
        export_job = service.create_export(
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
        publish_workbench_event(
            "workbench.export.created",
            borehole_id=borehole_id,
            entity="export_job",
            operation="created",
            payload={"export_job_id": export_job.id, "export_type": export_job.export_type},
        )
        return export_job
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
