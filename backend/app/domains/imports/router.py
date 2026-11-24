from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.realtime import publish_workbench_event
from app.db.session import get_db
from app.domains.auth.router import admin_user
from app.domains.imports import service
from app.domains.imports.schemas import (
    ImportProfileArchive,
    ImportProfileCreate,
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


def _profile_out(profile) -> ImportProfileOut:
    out = ImportProfileOut.model_validate(profile)
    out.builtin = service.is_builtin_import_profile(profile)
    return out


def _publish_profile_event(profile, operation: str) -> None:
    publish_workbench_event(
        f"workbench.import_profile.{operation}",
        borehole_id=None,
        entity="import_profile",
        operation=operation,
        payload={"profile_id": profile.id, "profile_type": profile.profile_type},
    )


@router.get("/profiles", response_model=list[ImportProfileOut])
def list_profiles(db: Session = Depends(get_db)) -> list[ImportProfileOut]:
    return [_profile_out(profile) for profile in service.list_import_profiles(db)]


@router.post("/profiles", response_model=ImportProfileOut)
def create_profile(
    payload: ImportProfileCreate,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> ImportProfileOut:
    try:
        profile = service.create_import_profile(
            db, name=payload.name, description=payload.description, mapping=payload.mapping
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    _publish_profile_event(profile, "created")
    return _profile_out(profile)


@router.patch("/profiles/{profile_id}", response_model=ImportProfileOut)
def update_profile(
    profile_id: int,
    payload: ImportProfilePatch,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> ImportProfileOut:
    try:
        profile = service.update_import_profile(
            db,
            profile_id,
            name=payload.name,
            description=payload.description,
            mapping=payload.mapping,
        )
    except ValueError as exc:
        status = 404 if "not found" in str(exc) else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    _publish_profile_event(profile, "updated")
    return _profile_out(profile)


@router.post("/profiles/{profile_id}/archive", response_model=ImportProfileOut)
def archive_profile(
    profile_id: int,
    payload: ImportProfileArchive,
    db: Session = Depends(get_db),
    _: object = Depends(admin_user),
) -> ImportProfileOut:
    try:
        profile = service.set_import_profile_archived(db, profile_id, payload.archived)
    except ValueError as exc:
        status = 404 if "not found" in str(exc) else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    _publish_profile_event(profile, "archived" if payload.archived else "restored")
    return _profile_out(profile)


@router.post("/profiles/inspect-sample")
def inspect_template_sample(
    file: UploadFile = File(...),
    _: object = Depends(admin_user),
) -> dict:
    """First rows of each sheet of a sample workbook, for the template builder."""
    with service.temporary_upload(file) as path:
        try:
            return service.inspect_template_sample(path)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not read workbook: {exc}") from exc


@router.post("/profiles/test")
def test_template(
    file: UploadFile = File(...),
    mapping: str = Form(...),
    borehole_code: str | None = Form(default=None),
    _: object = Depends(admin_user),
) -> dict:
    """Dry run: read a sample with a draft template. Nothing is written."""
    with service.temporary_upload(file) as path:
        try:
            return service.test_template_on_sample(path, mapping, borehole_code)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            # Unreadable or corrupt workbooks (zip/XML errors) are a user problem, not a 500.
            raise HTTPException(status_code=400, detail=f"Could not read workbook: {exc}") from exc


@router.get("/source-files", response_model=list[SourceFileOut])
def list_source_files(
    borehole_id: int | None = None, db: Session = Depends(get_db)
) -> list[SourceFileOut]:
    return service.list_source_files(db, borehole_id=borehole_id)


@router.post("/source-files", response_model=SourceFileOut)
def create_source_file(
    payload: SourceFileCreate, db: Session = Depends(get_db)
) -> SourceFileOut:
    source_file = service.create_source_file(db, payload)
    publish_workbench_event(
        "workbench.source_file.created",
        borehole_id=source_file.borehole_id,
        entity="source_file",
        operation="created",
        payload={"source_file_id": source_file.id, "file_type": source_file.file_type},
    )
    return source_file


@router.post("/upload", response_model=SourceFileOut)
def upload_source_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    borehole_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> SourceFileOut:
    source_file = service.upload_source_file(db, file=file, file_type=file_type, borehole_id=borehole_id)
    publish_workbench_event(
        "workbench.source_file.uploaded",
        borehole_id=source_file.borehole_id,
        entity="source_file",
        operation="uploaded",
        payload={"source_file_id": source_file.id, "file_type": source_file.file_type},
    )
    return source_file


@router.patch("/source-files/{source_file_id}", response_model=SourceFileOut)
def update_source_file_status(
    source_file_id: int, payload: SourceFileStatusPatch, db: Session = Depends(get_db)
) -> SourceFileOut:
    try:
        source_file = service.update_source_file_status(db, source_file_id, payload.status)
        publish_workbench_event(
            "workbench.source_file.updated",
            borehole_id=source_file.borehole_id,
            entity="source_file",
            operation="status_updated",
            payload={"source_file_id": source_file.id, "status": source_file.status},
        )
        return source_file
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/source-files/{source_file_id}/process", response_model=SourceFileProcessOut)
def process_source_file(source_file_id: int, db: Session = Depends(get_db)) -> SourceFileProcessOut:
    try:
        source_file, source_import, summary = service.process_source_file(db, source_file_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    publish_workbench_event(
        "workbench.source_file.processed",
        borehole_id=source_file.borehole_id,
        entity="source_file",
        operation="processed",
        payload={"source_file_id": source_file.id, "source_import_id": source_import.id},
    )
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
    publish_workbench_event(
        "workbench.borehole.imported",
        borehole_id=borehole_id,
        entity="borehole",
        operation="created_from_source",
        payload={"source_file_id": source_file.id, "borehole_code": borehole_code},
    )
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
    publish_workbench_event(
        "workbench.source_file.merged",
        borehole_id=borehole_id,
        entity="source_file",
        operation="merged",
        payload={"source_file_id": source_file.id, "status": status},
    )
    return SourceFileMergeOut(
        source_file=source_file,
        borehole_id=borehole_id,
        status=status,
        summary=summary,
    )
