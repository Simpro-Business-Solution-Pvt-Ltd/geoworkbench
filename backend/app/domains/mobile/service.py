from copy import deepcopy

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import (
    Borehole,
    Curve,
    CurveSample,
    DisplayLayout,
    FieldSubmission,
    LithologyInterval,
    Project,
    SeamInterval,
    Site,
    SourceImport,
)
from app.domains.boreholes.schemas import BoreholeListItem
from app.domains.display_layouts.defaults import default_borehole_layout
from app.domains.mobile.schemas import (
    MobileBoreholeCreate,
    MobileDemoCopyCreate,
    MobileFieldSubmissionCreate,
)
from app.services.validation.borehole_validation import replace_validation_issues, validate_borehole


def _list_item(borehole: Borehole) -> BoreholeListItem:
    return BoreholeListItem(
        id=borehole.id,
        code=borehole.code,
        title=borehole.title,
        total_depth=borehole.total_depth,
        workflow_status=borehole.workflow_status,
        site_code=borehole.site.code,
        project_code=borehole.site.project.code,
    )


def _get_or_create_site(db: Session, payload: MobileBoreholeCreate) -> Site:
    project = db.scalar(select(Project).where(Project.code == payload.project_code))
    if project is None:
        project = Project(code=payload.project_code, name=payload.project_name)
        db.add(project)
        db.flush()
    site = db.scalar(
        select(Site).where(Site.project_id == project.id).where(Site.code == payload.site_code)
    )
    if site is None:
        site = Site(project=project, code=payload.site_code, name=payload.site_name or payload.site_code)
        db.add(site)
        db.flush()
    return site


def create_mobile_borehole(db: Session, payload: MobileBoreholeCreate) -> Borehole:
    existing = db.scalar(select(Borehole).where(Borehole.code == payload.borehole_code))
    if existing is not None:
        return existing
    site = _get_or_create_site(db, payload)
    total_depth = payload.current_depth or payload.total_depth or 0
    borehole = Borehole(
        site=site,
        code=payload.borehole_code,
        title=payload.title or f"{payload.borehole_code} field capture",
        state=payload.state,
        total_depth=total_depth,
        closure_note="FIELD LOGGING IN PROGRESS",
        workflow_status="logging_in_progress",
        attributes={
            "capture_source": "mobile",
            "block": payload.site_code,
            "collar": {
                "coalgrid_easting": payload.coalgrid_easting,
                "coalgrid_northing": payload.coalgrid_northing,
                "utm_easting": payload.utm_easting,
                "utm_northing": payload.utm_northing,
                "reduced_level": payload.reduced_level,
                "water_level": payload.water_level,
                "coordinate_system": payload.coordinate_system,
            },
        },
    )
    borehole.display_layouts.append(
        DisplayLayout(name="Mobile Field Review", mode="runtime", settings=default_borehole_layout())
    )
    borehole.field_submissions.append(
        FieldSubmission(
            submission_type="mobile_borehole_create",
            status="synced",
            submitted_by="mobile-app",
            payload=payload.model_dump(),
        )
    )
    db.add(borehole)
    db.commit()
    db.refresh(borehole)
    return borehole


def submit_field_data(db: Session, payload: MobileFieldSubmissionCreate) -> FieldSubmission:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == payload.borehole_id)
        .options(selectinload(Borehole.lithology_intervals), selectinload(Borehole.validation_issues))
    )
    if borehole is None:
        raise ValueError("Borehole not found")
    if payload.current_depth is not None:
        borehole.total_depth = max(borehole.total_depth, payload.current_depth)
        borehole.workflow_status = "field_submitted"

    submission = FieldSubmission(
        borehole=borehole,
        submission_type=payload.submission_type,
        status=payload.status,
        submitted_by=payload.submitted_by,
        payload=payload.model_dump(),
    )
    borehole.field_submissions.append(submission)

    if payload.apply_to_log and payload.lithology_intervals:
        start_index = len(borehole.lithology_intervals) + 1
        for index, item in enumerate(payload.lithology_intervals, start=start_index):
            borehole.lithology_intervals.append(
                LithologyInterval(
                    id=f"{borehole.code.lower()}-mobile-lith-{index}",
                    source_row=None,
                    from_depth=item.from_depth,
                    to_depth=item.to_depth,
                    lithology_code=item.lithology_code,
                    lithology_label=item.lithology_label or item.lithology_code or "Unknown",
                    display_color="#8aa29e",
                    logged_color=item.logged_color,
                    seam_name=item.seam_name,
                    recovery=item.recovery,
                    recovery_percent=item.recovery_percent,
                    rqd=item.rqd,
                    structural_features=item.structural_features,
                    remark=item.remark,
                )
            )
    replace_validation_issues(borehole, validate_borehole(borehole))
    db.add(borehole)
    db.commit()
    db.refresh(submission)
    return submission


def create_demo_copy(db: Session, payload: MobileDemoCopyCreate) -> Borehole:
    existing = db.scalar(select(Borehole).where(Borehole.code == payload.new_code))
    if existing is not None:
        return existing
    source = db.scalar(
        select(Borehole)
        .where(Borehole.id == payload.source_borehole_id)
        .options(
            selectinload(Borehole.site).selectinload(Site.project),
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.seam_intervals),
            selectinload(Borehole.curves).selectinload(Curve.samples),
            selectinload(Borehole.core_images),
        )
    )
    if source is None:
        raise ValueError("Source borehole not found")

    borehole = Borehole(
        site=source.site,
        code=payload.new_code,
        title=f"{source.title} {payload.title_suffix}".strip(),
        state=source.state,
        total_depth=source.total_depth,
        closure_note="MOBILE DEMO COPY - FIELD SUBMITTED",
        source_workbook=source.source_workbook,
        source_sheet=source.source_sheet,
        workflow_status="field_submitted",
    )
    for item in source.lithology_intervals:
        borehole.lithology_intervals.append(
            LithologyInterval(
                id=f"{payload.new_code.lower()}-{item.id}",
                source_row=item.source_row,
                from_depth=item.from_depth,
                to_depth=item.to_depth,
                lithology_code=item.lithology_code,
                lithology_label=item.lithology_label,
                display_color=item.display_color,
                logged_color=item.logged_color,
                seam_name=item.seam_name,
                recovery=item.recovery,
                recovery_percent=item.recovery_percent,
                rqd=item.rqd,
                structural_features=item.structural_features,
                remark=item.remark,
                image_box=item.image_box,
                image_file=item.image_file,
            )
        )
    for item in source.seam_intervals:
        borehole.seam_intervals.append(
            SeamInterval(
                id=f"{payload.new_code.lower()}-{item.id}",
                source_row=item.source_row,
                name=item.name,
                from_depth=item.from_depth,
                to_depth=item.to_depth,
                thickness=item.thickness,
                lithology_code=item.lithology_code,
                lithology_label=item.lithology_label,
                image_box=item.image_box,
            )
        )
    for curve in source.curves:
        next_curve = Curve(
            key=curve.key,
            label=curve.label,
            unit=curve.unit,
            source_type="mobile_demo_copy",
            color=curve.color,
        )
        next_curve.samples = [
            CurveSample(depth=sample.depth, value=sample.value) for sample in curve.samples
        ]
        borehole.curves.append(next_curve)

    borehole.display_layouts.append(
        DisplayLayout(
            name="Mobile Submitted Review",
            mode="runtime",
            settings=deepcopy(default_borehole_layout()),
        )
    )
    borehole.source_imports.append(
        SourceImport(
            import_type="mobile_demo_copy",
            source_name=source.code,
            status="field_submitted",
            summary={"source_borehole_id": source.id, "source_code": source.code},
        )
    )
    borehole.field_submissions.append(
        FieldSubmission(
            submission_type="mobile_demo_copy",
            status="synced",
            submitted_by=payload.submitted_by,
            payload=payload.model_dump(),
        )
    )
    db.add(borehole)
    db.flush()
    replace_validation_issues(borehole, validate_borehole(borehole))
    db.commit()
    db.refresh(borehole)
    return borehole
