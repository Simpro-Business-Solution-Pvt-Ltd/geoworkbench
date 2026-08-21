from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from pathlib import Path
import json
from copy import deepcopy

from app.db.models import Borehole, CoreImage, CorrectionAudit, Curve, DisplayLayout, LithologyInterval, Project, Site
from app.domains.boreholes.schemas import (
    BoreholeListItem,
    BoreholeStatusOut,
    BoreholeWorkbenchOut,
    CoreImageOut,
    CurveOut,
    DisplayLayoutPatch,
    CurveSampleOut,
    CorrectionAuditOut,
    DisplayLayoutOut,
    LithologyIntervalPatch,
)
from app.domains.display_layouts.defaults import default_borehole_layout
from app.services.las_import import display_curve_samples
from app.domains.quality.service import get_quality_settings_payload
from app.services.data_stage import GEOLOGIST_CORRECTED, merge_stage_metadata
from app.services.validation.borehole_validation import replace_validation_issues, validate_borehole


COREBOX_ROOT_NAME = "MTSE-65(PBH 62)"


def corebox_asset_name(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    path = Path(relative_path)
    parts = path.parts
    if parts and parts[0] == COREBOX_ROOT_NAME:
        return "/".join(parts[1:])
    return "/".join(parts)


def corebox_asset_url(core_root: Path, asset_name: str | None) -> str | None:
    if not asset_name:
        return None
    asset_path = core_root / Path(asset_name)
    if not asset_path.exists():
        return None
    return f"/assets/corebox/{asset_name}?v={int(asset_path.stat().st_mtime)}"


def numeric_metadata_value(metadata: dict | None, key: str) -> float | None:
    if not metadata:
        return None
    value = metadata.get(key)
    return value if isinstance(value, (int, float)) else None


def list_boreholes(db: Session) -> list[BoreholeListItem]:
    rows = db.execute(
        select(Borehole, Site, Project)
        .join(Site, Borehole.site_id == Site.id)
        .join(Project, Site.project_id == Project.id)
        .order_by(Project.code, Site.code, Borehole.code)
    ).all()
    return [
        BoreholeListItem(
            id=borehole.id,
            code=borehole.code,
            title=borehole.title,
            total_depth=borehole.total_depth,
            workflow_status=borehole.workflow_status,
            site_code=site.code,
            project_code=project.code,
        )
        for borehole, site, project in rows
    ]


def _display_layout_options(borehole: Borehole) -> list[DisplayLayout]:
    return sorted(borehole.display_layouts, key=lambda item: item.id or 0)


def _select_display_layout(borehole: Borehole, display_layout_id: int | None = None) -> DisplayLayout | None:
    layouts = _display_layout_options(borehole)
    if display_layout_id is not None:
        return next((layout for layout in layouts if layout.id == display_layout_id), None)
    return layouts[0] if layouts else None


def get_workbench(db: Session, borehole_id: int, display_layout_id: int | None = None) -> BoreholeWorkbenchOut:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.seam_intervals),
            selectinload(Borehole.core_images),
            selectinload(Borehole.display_layouts),
            selectinload(Borehole.validation_issues),
            selectinload(Borehole.ai_suggestions),
            selectinload(Borehole.source_imports),
            selectinload(Borehole.source_files),
            selectinload(Borehole.field_submissions),
            selectinload(Borehole.curves),
        )
    )
    if borehole is None:
        raise ValueError("Borehole not found")

    curves = []
    for curve in sorted(borehole.curves, key=lambda item: item.key):
        samples, display_metadata = display_curve_samples(db, curve)
        curves.append(CurveOut(
            id=curve.id,
            key=curve.key,
            label=curve.label,
            unit=curve.unit,
            source_type=curve.source_type,
            color=curve.color,
            curve_metadata={**(curve.curve_metadata or {}), **display_metadata},
            samples=[
                CurveSampleOut(depth=sample.depth, value=sample.value)
                for sample in sorted(samples, key=lambda item: item.depth)
            ],
        ))

    core_root = Path(__file__).resolve().parents[4] / COREBOX_ROOT_NAME
    rock_lane_manifest_path = core_root / "core-rock-lanes" / borehole.code / "manifest.json"
    rock_lane_manifest_by_box: dict[int, dict] = {}
    if rock_lane_manifest_path.exists():
        manifest = json.loads(rock_lane_manifest_path.read_text(encoding="utf-8"))
        rock_lane_manifest_by_box = {
            int(box["box_number"]): box
            for box in manifest.get("boxes", [])
            if box.get("box_number") is not None
        }

    images = []
    for image in sorted(borehole.core_images, key=lambda item: item.box_number):
        original_name = Path(image.file_path or image.name).name
        if image.name.startswith("demo-coal-block/"):
            original_name = image.name
        rock_lane_metadata = rock_lane_manifest_by_box.get(image.box_number)
        rock_lane_name = corebox_asset_name(
            rock_lane_metadata.get("strip_image") if rock_lane_metadata else None
        )
        rock_lane_preview_name = corebox_asset_name(
            rock_lane_metadata.get("preview_image") if rock_lane_metadata else None
        )
        rock_lane_url = corebox_asset_url(core_root, rock_lane_name)
        rock_lane_preview_url = corebox_asset_url(core_root, rock_lane_preview_name)
        strip_url = rock_lane_url
        strip_preview_url = rock_lane_preview_url if rock_lane_url else None
        strip_metadata = rock_lane_metadata
        from_depth = numeric_metadata_value(strip_metadata, "calibrated_from_depth")
        to_depth = numeric_metadata_value(strip_metadata, "calibrated_to_depth")
        original_url = f"/assets/corebox/{original_name}"
        images.append(
            CoreImageOut(
                box_number=image.box_number,
                name=image.name,
                file_path=image.file_path,
                from_depth=from_depth if from_depth is not None else image.from_depth,
                to_depth=to_depth if to_depth is not None else image.to_depth,
                url=strip_preview_url or strip_url or original_url,
                original_url=original_url,
                strip_url=strip_url,
                strip_preview_url=strip_preview_url,
                strip_metadata=strip_metadata,
                image_metadata=image.image_metadata,
            )
        )

    layout_options = _display_layout_options(borehole)
    layout = _select_display_layout(borehole, display_layout_id)
    correction_audits = list(
        db.scalars(
            select(CorrectionAudit)
            .where(CorrectionAudit.borehole_id == borehole.id)
            .order_by(CorrectionAudit.changed_at.desc(), CorrectionAudit.id.desc())
        )
    )
    return BoreholeWorkbenchOut(
        id=borehole.id,
        code=borehole.code,
        title=borehole.title,
        state=borehole.state,
        total_depth=borehole.total_depth,
        closure_note=borehole.closure_note,
        source_workbook=borehole.source_workbook,
        source_sheet=borehole.source_sheet,
        workflow_status=borehole.workflow_status,
        attributes=borehole.attributes,
        lithology_intervals=sorted(borehole.lithology_intervals, key=lambda item: item.from_depth),
        seam_intervals=sorted(borehole.seam_intervals, key=lambda item: item.from_depth),
        curves=curves,
        core_images=images,
        layout=DisplayLayoutOut(
            id=layout.id,
            name=layout.name,
            mode=layout.mode,
            settings=layout.settings,
        )
        if layout
        else None,
        display_layouts=[
            DisplayLayoutOut(
                id=option.id,
                name=option.name,
                mode=option.mode,
                settings=option.settings,
            )
            for option in layout_options
        ],
        validation_issues=sorted(
            borehole.validation_issues,
            key=lambda item: (
                {"error": 0, "warning": 1, "info": 2}.get(item.severity, 3),
                item.from_depth if item.from_depth is not None else -1,
            ),
        ),
        ai_suggestions=sorted(
            borehole.ai_suggestions,
            key=lambda item: (
                {"open": 0, "accepted": 1, "rejected": 2}.get(item.status, 3),
                item.from_depth if item.from_depth is not None else -1,
                item.id,
            ),
        ),
        source_imports=sorted(borehole.source_imports, key=lambda item: item.id),
        field_submissions=sorted(borehole.field_submissions, key=lambda item: item.id),
        source_files=sorted(borehole.source_files, key=lambda item: item.id),
        correction_audits=[CorrectionAuditOut.model_validate(item) for item in correction_audits],
    )


def update_lithology_interval(
    db: Session, interval_id: str, patch: LithologyIntervalPatch, actor: str = "system"
) -> LithologyInterval:
    interval = db.get(LithologyInterval, interval_id)
    if interval is None:
        raise ValueError("Interval not found")

    updates = patch.model_dump(exclude_unset=True)
    before_values = {field: getattr(interval, field) for field in updates}
    before_attributes = dict(interval.attributes or {})
    for field, value in updates.items():
        setattr(interval, field, value)

    after_values = {field: getattr(interval, field) for field in updates}
    if before_values != after_values:
        interval.attributes = merge_stage_metadata(
            interval.attributes,
            GEOLOGIST_CORRECTED,
            source_type="manual_edit",
            actor=actor,
            note="Central geologist correction saved from workbench.",
        )
        db.add(
            CorrectionAudit(
                borehole_id=interval.borehole_id,
                interval_id=interval.id,
                changed_by=actor,
                before_values={**before_values, "attributes": before_attributes},
                after_values={**after_values, "attributes": interval.attributes},
            )
        )
    db.add(interval)
    db.commit()
    db.refresh(interval)
    return interval


def find_core_image_for_depth(db: Session, borehole_id: int, depth: float) -> CoreImage | None:
    return db.scalar(
        select(CoreImage)
        .where(CoreImage.borehole_id == borehole_id)
        .where(CoreImage.from_depth <= depth)
        .where(CoreImage.to_depth >= depth)
        .order_by(CoreImage.box_number)
    )


def update_display_layout(
    db: Session, layout_id: int, patch: DisplayLayoutPatch
) -> DisplayLayout:
    layout = db.get(DisplayLayout, layout_id)
    if layout is None:
        raise ValueError("Display layout not found")

    updates = patch.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if value is not None:
            setattr(layout, field, value)
    db.add(layout)
    db.commit()
    db.refresh(layout)
    return layout


def clone_display_layout(db: Session, layout_id: int, name: str | None = None) -> DisplayLayout:
    source = db.get(DisplayLayout, layout_id)
    if source is None:
        raise ValueError("Display layout not found")
    clone = DisplayLayout(
        borehole_id=source.borehole_id,
        name=name or f"{source.name} Copy",
        mode=source.mode,
        settings=deepcopy(source.settings),
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


def delete_display_layout(db: Session, layout_id: int) -> DisplayLayout:
    layout = db.scalar(
        select(DisplayLayout)
        .where(DisplayLayout.id == layout_id)
        .options(selectinload(DisplayLayout.borehole).selectinload(Borehole.display_layouts))
    )
    if layout is None:
        raise ValueError("Display layout not found")
    borehole = layout.borehole
    remaining = [item for item in _display_layout_options(borehole) if item.id != layout.id]
    if not remaining:
        raise ValueError("At least one display layout must remain")
    fallback = remaining[0]
    db.delete(layout)
    db.commit()
    db.refresh(fallback)
    return fallback


def reset_borehole_display_layout(db: Session, borehole_id: int) -> DisplayLayout:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(selectinload(Borehole.display_layouts))
    )
    if borehole is None:
        raise ValueError("Borehole not found")
    layout = borehole.display_layouts[0] if borehole.display_layouts else None
    if layout is None:
        layout = DisplayLayout(borehole=borehole, name="Default Borehole Log", mode="runtime", settings={})
    layout.settings = default_borehole_layout()
    layout.mode = "runtime"
    db.add(layout)
    db.commit()
    db.refresh(layout)
    return layout


def approve_borehole_for_export(db: Session, borehole_id: int) -> BoreholeStatusOut:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.validation_issues),
            selectinload(Borehole.ai_suggestions),
            selectinload(Borehole.curves).selectinload(Curve.samples),
            selectinload(Borehole.core_images),
        )
    )
    if borehole is None:
        raise ValueError("Borehole not found")

    replace_validation_issues(borehole, validate_borehole(borehole, get_quality_settings_payload(db)))
    blocking_errors = [issue for issue in borehole.validation_issues if issue.severity == "error"]
    if blocking_errors:
        db.add(borehole)
        db.commit()
        return BoreholeStatusOut(
            id=borehole.id,
            code=borehole.code,
            workflow_status=borehole.workflow_status,
            message=f"Cannot approve: {len(blocking_errors)} validation error(s) remain.",
        )

    before_status = borehole.workflow_status
    borehole.workflow_status = "approved_for_export"
    db.add(
        CorrectionAudit(
            borehole_id=borehole.id,
            interval_id=borehole.lithology_intervals[0].id if borehole.lithology_intervals else "",
            entity_type="borehole",
            changed_by="central-geologist",
            change_reason="Approved borehole for export",
            before_values={"workflow_status": before_status},
            after_values={"workflow_status": borehole.workflow_status},
        )
    )
    db.add(borehole)
    db.commit()
    return BoreholeStatusOut(
        id=borehole.id,
        code=borehole.code,
        workflow_status=borehole.workflow_status,
        message="Borehole approved for export.",
    )
