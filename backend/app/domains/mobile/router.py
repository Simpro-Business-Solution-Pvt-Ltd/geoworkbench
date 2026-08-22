from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.realtime import publish_workbench_event
from app.db.session import get_db
from app.domains.mobile import service
from app.domains.mobile.schemas import (
    MobileBoreholeCreate,
    MobileDemoCopyCreate,
    MobileFieldSubmissionCreate,
    MobileSubmissionOut,
)
from app.domains.imports.service import upload_source_file

router = APIRouter()


@router.post("/boreholes", response_model=MobileSubmissionOut)
def create_mobile_borehole(
    payload: MobileBoreholeCreate, db: Session = Depends(get_db)
) -> MobileSubmissionOut:
    borehole = service.create_mobile_borehole(db, payload)
    publish_workbench_event(
        "workbench.mobile.borehole_created",
        borehole_id=borehole.id,
        entity="borehole",
        operation="created_from_mobile",
        payload={"code": borehole.code},
    )
    return MobileSubmissionOut(
        borehole=service._list_item(borehole),
        field_submission_id=borehole.field_submissions[-1].id if borehole.field_submissions else None,
        message="Mobile borehole draft is ready for central review.",
    )


@router.post("/field-submissions", response_model=MobileSubmissionOut)
def submit_field_data(
    payload: MobileFieldSubmissionCreate, db: Session = Depends(get_db)
) -> MobileSubmissionOut:
    try:
        submission = service.submit_field_data(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    publish_workbench_event(
        "workbench.mobile.field_submission",
        borehole_id=submission.borehole_id,
        entity="field_submission",
        operation="created",
        payload={"field_submission_id": submission.id},
    )
    return MobileSubmissionOut(
        borehole=service._list_item(submission.borehole),
        field_submission_id=submission.id,
        message="Field submission synced to central backend.",
    )


@router.post("/demo-copy", response_model=MobileSubmissionOut)
def create_demo_copy(
    payload: MobileDemoCopyCreate, db: Session = Depends(get_db)
) -> MobileSubmissionOut:
    try:
        borehole = service.create_demo_copy(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    publish_workbench_event(
        "workbench.mobile.demo_copy_created",
        borehole_id=borehole.id,
        entity="borehole",
        operation="created_from_mobile",
        payload={"code": borehole.code},
    )
    return MobileSubmissionOut(
        borehole=service._list_item(borehole),
        field_submission_id=borehole.field_submissions[-1].id if borehole.field_submissions else None,
        message="Demo borehole copy submitted from mobile workflow.",
    )


@router.post("/uploads")
def upload_mobile_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    borehole_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
) -> dict:
    source_file = upload_source_file(db, file=file, file_type=file_type, borehole_id=borehole_id)
    publish_workbench_event(
        "workbench.mobile.file_uploaded",
        borehole_id=source_file.borehole_id,
        entity="source_file",
        operation="uploaded",
        payload={"source_file_id": source_file.id, "file_type": source_file.file_type},
    )
    return {
        "id": source_file.id,
        "borehole_id": source_file.borehole_id,
        "file_type": source_file.file_type,
        "original_name": source_file.original_name,
        "status": source_file.status,
    }
