from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.domains.imports import service
from app.domains.imports.schemas import (
    ImportProfilePatch,
    ImportProfileOut,
    SourceFileCreate,
    SourceFileImportOut,
    SourceFileMergeOut,
    SourceFileMergeRequest,
    SourceFileOut,
    SourceFileProcessOut,
    SourceFileStatusPatch,
)

router = APIRouter()


@router.get("/profiles", response_model=list[ImportProfileOut])
def list_profiles(db: Session = Depends(get_db)) -> list[ImportProfileOut]:
    return service.list_import_profiles(db)


@router.patch("/profiles/{profile_id}", response_model=ImportProfileOut)
def update_profile(
    profile_id: int, payload: ImportProfilePatch, db: Session = Depends(get_db)
) -> ImportProfileOut:
    try:
        return service.update_import_profile(
            db,
            profile_id,
            name=payload.name,
            description=payload.description,
            mapping=payload.mapping,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/source-files", response_model=list[SourceFileOut])
def list_source_files(
    borehole_id: int | None = None, db: Session = Depends(get_db)
) -> list[SourceFileOut]:
    return service.list_source_files(db, borehole_id=borehole_id)


@router.post("/source-files", response_model=SourceFileOut)
def create_source_file(
    payload: SourceFileCreate, db: Session = Depends(get_db)
) -> SourceFileOut:
    return service.create_source_file(db, payload)


@router.post("/upload", response_model=SourceFileOut)
def upload_source_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    borehole_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> SourceFileOut:
    return service.upload_source_file(db, file=file, file_type=file_type, borehole_id=borehole_id)


@router.patch("/source-files/{source_file_id}", response_model=SourceFileOut)
def update_source_file_status(
    source_file_id: int, payload: SourceFileStatusPatch, db: Session = Depends(get_db)
) -> SourceFileOut:
    try:
        return service.update_source_file_status(db, source_file_id, payload.status)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/source-files/{source_file_id}/process", response_model=SourceFileProcessOut)
def process_source_file(source_file_id: int, db: Session = Depends(get_db)) -> SourceFileProcessOut:
    try:
        source_file, source_import, summary = service.process_source_file(db, source_file_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SourceFileProcessOut(
        source_file=source_file,
        source_import_id=source_import.id,
        summary=summary,
    )


@router.post("/source-files/{source_file_id}/import-borehole", response_model=SourceFileImportOut)
def import_source_file_as_borehole(
    source_file_id: int, db: Session = Depends(get_db)
) -> SourceFileImportOut:
    try:
        source_file, borehole_id, borehole_code, summary = service.import_source_file_as_borehole(
            db, source_file_id
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SourceFileImportOut(
        source_file=source_file,
        borehole_id=borehole_id,
        borehole_code=borehole_code,
        summary=summary,
    )


@router.post("/source-files/{source_file_id}/merge", response_model=SourceFileMergeOut)
def merge_source_file_into_borehole(
    source_file_id: int,
    payload: SourceFileMergeRequest | None = None,
    db: Session = Depends(get_db),
) -> SourceFileMergeOut:
    try:
        source_file, borehole_id, status, summary = service.merge_source_file_into_borehole(
            db,
            source_file_id,
            merge_options=payload.model_dump(exclude_none=True) if payload else None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return SourceFileMergeOut(
        source_file=source_file,
        borehole_id=borehole_id,
        status=status,
        summary=summary,
    )
