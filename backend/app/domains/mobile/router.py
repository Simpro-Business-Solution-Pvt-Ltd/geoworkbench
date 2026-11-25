from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.realtime import publish_workbench_event
from app.db.session import get_db
from app.domains.auth.router import current_user
from app.domains.mobile import service
from app.domains.mobile.schemas import (
    MobileBoreholeCreate,
    MobileDemoCopyCreate,
    MobileFieldSubmissionCreate,
    MobileSubmissionOut,
)
from app.domains.imports.service import upload_source_file

router = APIRouter()


def _original_device_captured_at(submission) -> str | None:
    """The device capture time exactly as the field device sent it (with its local
    UTC offset), read from the stored payload — the authoritative device record —
    rather than the database column, which normalizes the instant to UTC. Returns
    None when the submission carries no capture metadata (e.g. borehole-create or
    demo-copy submissions)."""
    if submission is None:
        return None
    payload = submission.payload
    if not isinstance(payload, dict):
        return None
    value = payload.get("device_captured_at")
    return value if isinstance(value, str) else None


def _submission_out(
    borehole,
    field_submission_id: int | None,
    message: str,
    *,
    submission=None,
    validation_issue_count: int = 0,
) -> MobileSubmissionOut:
    return MobileSubmissionOut(
        borehole=service._list_item(borehole),
        field_submission_id=field_submission_id,
        message=message,
        server_received_at=submission.submitted_at if submission is not None else None,
        device_captured_at=_original_device_captured_at(submission),
        device_timezone=submission.device_timezone if submission is not None else None,
        validation_issue_count=validation_issue_count,
    )


@router.post("/boreholes", response_model=MobileSubmissionOut)
def create_mobile_borehole(
    payload: MobileBoreholeCreate,
    db: Session = Depends(get_db),
    user=Depends(current_user),
) -> MobileSubmissionOut:
    borehole, created = service.create_mobile_borehole(db, payload)
    submission = borehole.field_submissions[-1] if created else None
    if created:
        publish_workbench_event(
            "workbench.mobile.borehole_created",
            borehole_id=borehole.id,
            entity="borehole",
            operation="created_from_mobile",
            payload={"code": borehole.code},
        )
    return _submission_out(
        borehole,
        submission.id if submission is not None else None,
        "Mobile borehole draft is ready for central review."
        if created
        else "Borehole already exists; returning the existing draft.",
        submission=submission,
    )


@router.post("/field-submissions", response_model=MobileSubmissionOut)
def submit_field_data(
    payload: MobileFieldSubmissionCreate,
    db: Session = Depends(get_db),
    user=Depends(current_user),
) -> MobileSubmissionOut:
    try:
        submission, replayed = service.submit_field_data(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if not replayed:
        publish_workbench_event(
            "workbench.mobile.field_submission",
            borehole_id=submission.borehole_id,
            entity="field_submission",
            operation="created",
            payload={"field_submission_id": submission.id},
        )
    return _submission_out(
        submission.borehole,
        submission.id,
        "Field submission synced to central backend."
        if not replayed
        else "Replay ignored: this outbox item was already synced.",
        submission=submission,
        validation_issue_count=len(submission.borehole.validation_issues),
    )


@router.post("/demo-copy", response_model=MobileSubmissionOut)
def create_demo_copy(
    payload: MobileDemoCopyCreate,
    db: Session = Depends(get_db),
    user=Depends(current_user),
) -> MobileSubmissionOut:
    try:
        borehole, created = service.create_demo_copy(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    submission = borehole.field_submissions[-1] if created else None
    if created:
        publish_workbench_event(
            "workbench.mobile.demo_copy_created",
            borehole_id=borehole.id,
            entity="borehole",
            operation="created_from_mobile",
            payload={"code": borehole.code},
        )
    return _submission_out(
        borehole,
        submission.id if submission is not None else None,
        "Demo borehole copy submitted from mobile workflow."
        if created
        else "Demo copy already exists; returning the existing borehole.",
        submission=submission,
    )


@router.post("/uploads")
def upload_mobile_file(
    file: UploadFile = File(...),
    file_type: str = Form(...),
    borehole_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    user=Depends(current_user),
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
