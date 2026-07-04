import csv
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.db.models import AiSuggestion, Borehole, Curve, ExportJob, ExportProfile, SourceFile


DEFAULT_EXPORT_PROFILES = [
    ExportProfile(
        name="Corrected Lithology Excel",
        export_type="corrected_lithology_xlsx",
        description="Corrected lithology interval workbook.",
        mapping={
            "sheet": "Corrected Lithology",
            "columns": [
                {"source": "borehole.code", "target": "Borehole"},
                {"source": "lithology.source_row", "target": "Source Row"},
                {"source": "lithology.from_depth", "target": "From Depth"},
                {"source": "lithology.to_depth", "target": "To Depth"},
                {"source": "lithology.thickness", "target": "Thickness"},
                {"source": "lithology.lithology_code", "target": "Lithology Code"},
                {"source": "lithology.lithology_label", "target": "Lithology Label"},
                {"source": "lithology.seam_name", "target": "Seam"},
                {"source": "lithology.recovery_percent", "target": "Recovery %"},
                {"source": "lithology.rqd_percent", "target": "RQD %"},
                {"source": "lithology.structural_features", "target": "Structural Features"},
                {"source": "lithology.remark", "target": "Remarks"},
            ],
        },
    ),
    ExportProfile(
        name="Corrected Lithology CSV",
        export_type="corrected_lithology_csv",
        description="Delimited interval table for analytics or package import.",
        mapping={"columns": ["borehole_code", "from_depth", "to_depth", "lithology_code", "seam_name", "rqd_percent"]},
    ),
    ExportProfile(
        name="Curve LAS",
        export_type="curves_las",
        description="LAS 2.0 curve export.",
        mapping={"depth": "DEPT.M", "curve_section": "~Curve Information", "sample_section": "~ASCII"},
    ),
    ExportProfile(
        name="Curve CSV",
        export_type="curves_csv",
        description="Wide depth-indexed curve table.",
        mapping={"depth_column": "depth", "curve_columns": "curve.key"},
    ),
]


def _load_borehole(db: Session, borehole_id: int) -> Borehole:
    borehole = db.scalar(
        select(Borehole)
        .where(Borehole.id == borehole_id)
        .options(
            selectinload(Borehole.lithology_intervals),
            selectinload(Borehole.seam_intervals),
            selectinload(Borehole.validation_issues),
            selectinload(Borehole.ai_suggestions),
            selectinload(Borehole.source_files),
            selectinload(Borehole.curves).selectinload(Curve.samples),
        )
    )
    if borehole is None:
        raise ValueError("Borehole not found")
    return borehole


def ensure_default_export_profiles(db: Session) -> None:
    changed = False
    for profile in DEFAULT_EXPORT_PROFILES:
        existing = db.scalar(select(ExportProfile).where(ExportProfile.name == profile.name))
        if existing is None:
            db.add(profile)
            changed = True
    if changed:
        db.commit()


def list_export_profiles(db: Session) -> list[ExportProfile]:
    ensure_default_export_profiles(db)
    return list(db.scalars(select(ExportProfile).order_by(ExportProfile.export_type, ExportProfile.name)))


def update_export_profile(
    db: Session,
    profile_id: int,
    *,
    name: str | None = None,
    description: str | None = None,
    mapping: dict | None = None,
) -> ExportProfile:
    profile = db.get(ExportProfile, profile_id)
    if profile is None:
        raise ValueError("Export profile not found")
    if name is not None:
        profile.name = name
    if description is not None:
        profile.description = description
    if mapping is not None:
        profile.mapping = mapping
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def export_readiness(db: Session, borehole_id: int) -> dict:
    borehole = _load_borehole(db, borehole_id)
    error_count = len([item for item in borehole.validation_issues if item.severity == "error"])
    warning_count = len([item for item in borehole.validation_issues if item.severity == "warning"])
    open_suggestions = len([item for item in borehole.ai_suggestions if item.status == "open"])
    has_excel = any(item.file_type == "excel" for item in borehole.source_files) or bool(borehole.source_workbook)
    has_curves = any(curve.samples for curve in borehole.curves)

    checks = [
        {
            "key": "export_authorization",
            "label": "Export permission required",
            "status": "pass",
            "detail": "Controlled by user role access",
        },
        {
            "key": "validation_errors",
            "label": "No blocking validation errors",
            "status": "pass" if error_count == 0 else "fail",
            "detail": f"{error_count} error(s)",
        },
        {
            "key": "validation_warnings",
            "label": "Warnings reviewed",
            "status": "pass" if warning_count == 0 else "warning",
            "detail": f"{warning_count} warning(s)",
        },
        {
            "key": "ai_suggestions",
            "label": "AI suggestions reviewed",
            "status": "pass" if open_suggestions == 0 else "warning",
            "detail": f"{open_suggestions} open suggestion(s)",
        },
        {
            "key": "source_excel",
            "label": "Source Excel available",
            "status": "pass" if has_excel else "warning",
            "detail": borehole.source_workbook or "No Excel source linked",
        },
        {
            "key": "curves",
            "label": "Geophysical curves available",
            "status": "pass" if has_curves else "warning",
            "detail": f"{len(borehole.curves)} curve track(s)",
        },
    ]
    ready = error_count == 0
    status = "ready" if ready and warning_count == 0 and open_suggestions == 0 else "quality_review"
    if error_count:
        status = "blocked"
    return {
        "borehole_id": borehole.id,
        "ready": ready,
        "status": status,
        "checks": checks,
        "counts": {
            "validation_errors": error_count,
            "validation_warnings": warning_count,
            "open_ai_suggestions": open_suggestions,
            "lithology_intervals": len(borehole.lithology_intervals),
            "seam_intervals": len(borehole.seam_intervals),
            "curves": len(borehole.curves),
        },
    }


def _export_dir(borehole: Borehole) -> Path:
    settings = get_settings()
    if settings.export_root is None:
        raise RuntimeError("Export root is not configured")
    target = settings.export_root / borehole.code
    target.mkdir(parents=True, exist_ok=True)
    return target


def _relative_to_repo(path: Path) -> str:
    settings = get_settings()
    return str(path.relative_to(settings.repo_root))


def _profile_for_export(db: Session, export_type: str, export_profile_id: int | None) -> ExportProfile | None:
    ensure_default_export_profiles(db)
    if export_profile_id is not None:
        profile = db.get(ExportProfile, export_profile_id)
        if profile is None:
            raise ValueError("Export profile not found")
        return profile
    return db.scalar(
        select(ExportProfile)
        .where(ExportProfile.export_type == export_type)
        .order_by(ExportProfile.id)
    )


def _in_depth_range(interval, from_depth: float | None, to_depth: float | None) -> bool:
    if from_depth is None and to_depth is None:
        return True
    start = from_depth if from_depth is not None else float("-inf")
    end = to_depth if to_depth is not None else float("inf")
    return interval.from_depth < end and interval.to_depth > start


def _interval_value(borehole: Borehole, interval, source: str):
    thickness = round(interval.to_depth - interval.from_depth, 3)
    values = {
        "borehole.code": borehole.code,
        "borehole.title": borehole.title,
        "lithology.source_row": interval.source_row,
        "lithology.from_depth": interval.from_depth,
        "lithology.to_depth": interval.to_depth,
        "lithology.thickness": thickness,
        "lithology.lithology_code": interval.lithology_code,
        "lithology.lithology_label": interval.lithology_label,
        "lithology.logged_color": interval.logged_color,
        "lithology.seam_name": interval.seam_name,
        "lithology.recovery": interval.recovery,
        "lithology.recovery_percent": interval.recovery_percent,
        "lithology.rqd_percent": round(interval.rqd * 100, 2) if interval.rqd is not None else None,
        "lithology.structural_features": interval.structural_features,
        "lithology.remark": interval.remark,
    }
    if source.startswith("lithology.attributes."):
        key = source.removeprefix("lithology.attributes.")
        return (interval.attributes or {}).get(key)
    return values.get(source)


def _column_mapping(profile: ExportProfile | None, fallback: list[tuple[str, str]]) -> list[tuple[str, str]]:
    columns = (profile.mapping or {}).get("columns") if profile else None
    if not isinstance(columns, list):
        return fallback
    mapped: list[tuple[str, str]] = []
    for item in columns:
        if isinstance(item, str):
            mapped.append((item, item))
        elif isinstance(item, dict):
            source = str(item.get("source") or item.get("key") or "")
            target = str(item.get("target") or item.get("label") or source)
            if source:
                mapped.append((source, target))
    return mapped or fallback


def _curve_keys_from_profile(profile: ExportProfile | None) -> set[str] | None:
    if profile is None:
        return None
    curves = profile.mapping.get("curves")
    if not isinstance(curves, list):
        return None
    keys = {str(item) for item in curves if str(item)}
    return keys or None


def export_corrected_lithology_csv(
    db: Session,
    borehole_id: int,
    *,
    profile: ExportProfile | None = None,
    export_settings: dict | None = None,
) -> ExportJob:
    borehole = _load_borehole(db, borehole_id)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"{borehole.code}-corrected-lithology-{timestamp}.csv"
    path = _export_dir(borehole) / file_name
    export_settings = export_settings or {}
    intervals = [
        interval
        for interval in sorted(borehole.lithology_intervals, key=lambda item: (item.from_depth, item.to_depth))
        if _in_depth_range(interval, export_settings.get("from_depth"), export_settings.get("to_depth"))
    ]
    fallback = [
        ("borehole.code", "borehole_code"),
        ("lithology.source_row", "source_row"),
        ("lithology.from_depth", "from_depth"),
        ("lithology.to_depth", "to_depth"),
        ("lithology.thickness", "thickness"),
        ("lithology.lithology_code", "lithology_code"),
        ("lithology.lithology_label", "lithology_label"),
        ("lithology.logged_color", "logged_color"),
        ("lithology.seam_name", "seam_name"),
        ("lithology.recovery", "recovery"),
        ("lithology.recovery_percent", "recovery_percent"),
        ("lithology.rqd_percent", "rqd_percent"),
        ("lithology.structural_features", "structural_features"),
        ("lithology.remark", "remarks"),
    ]
    columns = _column_mapping(profile, fallback)

    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[target for _, target in columns],
        )
        writer.writeheader()
        for interval in intervals:
            writer.writerow({target: _interval_value(borehole, interval, source) for source, target in columns})

    job = ExportJob(
        borehole_id=borehole.id,
        export_type="corrected_lithology_csv",
        status="generated",
        file_path=_relative_to_repo(path),
        file_name=file_name,
        summary={
            "interval_count": len(intervals),
            "readiness": export_readiness(db, borehole_id),
            "export_profile": profile.name if profile else None,
            "export_settings": export_settings,
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def export_corrected_lithology_xlsx(
    db: Session,
    borehole_id: int,
    *,
    profile: ExportProfile | None = None,
    export_settings: dict | None = None,
) -> ExportJob:
    borehole = _load_borehole(db, borehole_id)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"{borehole.code}-corrected-lithology-{timestamp}.xlsx"
    path = _export_dir(borehole) / file_name
    export_settings = export_settings or {}
    intervals = [
        interval
        for interval in sorted(borehole.lithology_intervals, key=lambda item: (item.from_depth, item.to_depth))
        if _in_depth_range(interval, export_settings.get("from_depth"), export_settings.get("to_depth"))
    ]
    fallback = [
        ("borehole.code", "Borehole"),
        ("lithology.source_row", "Source Row"),
        ("lithology.from_depth", "From Depth"),
        ("lithology.to_depth", "To Depth"),
        ("lithology.thickness", "Thickness"),
        ("lithology.lithology_code", "Lithology Code"),
        ("lithology.lithology_label", "Lithology Label"),
        ("lithology.logged_color", "Color"),
        ("lithology.seam_name", "Seam"),
        ("lithology.recovery", "Recovery"),
        ("lithology.recovery_percent", "Recovery %"),
        ("lithology.rqd_percent", "RQD %"),
        ("lithology.structural_features", "Structural Features"),
        ("lithology.remark", "Remarks"),
    ]
    columns = _column_mapping(profile, fallback)

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = str((profile.mapping or {}).get("sheet", "Corrected Lithology")) if profile else "Corrected Lithology"
    sheet.append([target for _, target in columns])
    for interval in intervals:
        sheet.append([_interval_value(borehole, interval, source) for source, _ in columns])
    sheet.freeze_panes = "A2"
    for column_cells in sheet.columns:
        width = min(42, max(12, max(len(str(cell.value or "")) for cell in column_cells) + 2))
        sheet.column_dimensions[column_cells[0].column_letter].width = width
    workbook.save(path)

    job = ExportJob(
        borehole_id=borehole.id,
        export_type="corrected_lithology_xlsx",
        status="generated",
        file_path=_relative_to_repo(path),
        file_name=file_name,
        summary={
            "interval_count": len(intervals),
            "readiness": export_readiness(db, borehole_id),
            "export_profile": profile.name if profile else None,
            "export_settings": export_settings,
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def export_curves_csv(
    db: Session,
    borehole_id: int,
    *,
    profile: ExportProfile | None = None,
    export_settings: dict | None = None,
) -> ExportJob:
    borehole = _load_borehole(db, borehole_id)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"{borehole.code}-curves-{timestamp}.csv"
    path = _export_dir(borehole) / file_name
    export_settings = export_settings or {}
    curve_keys = _curve_keys_from_profile(profile)
    curves = sorted(
        [curve for curve in borehole.curves if curve_keys is None or curve.key in curve_keys],
        key=lambda item: item.key,
    )
    from_depth = export_settings.get("from_depth")
    to_depth = export_settings.get("to_depth")
    depths = sorted(
        {
            sample.depth
            for curve in curves
            for sample in curve.samples
            if (from_depth is None or sample.depth >= from_depth) and (to_depth is None or sample.depth <= to_depth)
        }
    )
    values = {
        (curve.key, sample.depth): sample.value
        for curve in curves
        for sample in curve.samples
    }

    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        fieldnames = ["depth"] + [curve.key for curve in curves]
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for depth in depths:
            row = {"depth": depth}
            for curve in curves:
                row[curve.key] = values.get((curve.key, depth))
            writer.writerow(row)

    job = ExportJob(
        borehole_id=borehole.id,
        export_type="curves_csv",
        status="generated",
        file_path=_relative_to_repo(path),
        file_name=file_name,
        summary={
            "curve_count": len(curves),
            "sample_depth_count": len(depths),
            "export_profile": profile.name if profile else None,
            "export_settings": export_settings,
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def export_curves_las(
    db: Session,
    borehole_id: int,
    *,
    profile: ExportProfile | None = None,
    export_settings: dict | None = None,
) -> ExportJob:
    borehole = _load_borehole(db, borehole_id)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"{borehole.code}-curves-{timestamp}.las"
    path = _export_dir(borehole) / file_name
    export_settings = export_settings or {}
    curve_keys = _curve_keys_from_profile(profile)
    curves = sorted(
        [curve for curve in borehole.curves if curve_keys is None or curve.key in curve_keys],
        key=lambda item: item.key,
    )
    from_depth = export_settings.get("from_depth")
    to_depth = export_settings.get("to_depth")
    depths = sorted(
        {
            sample.depth
            for curve in curves
            for sample in curve.samples
            if (from_depth is None or sample.depth >= from_depth) and (to_depth is None or sample.depth <= to_depth)
        }
    )
    values = {
        (curve.key, sample.depth): sample.value
        for curve in curves
        for sample in curve.samples
    }
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write("~Version Information\n")
        handle.write("VERS.                  2.0 : CWLS LAS version\n")
        handle.write("WRAP.                   NO : One line per depth step\n")
        handle.write("~Well Information\n")
        handle.write(f"WELL. {borehole.code} : Borehole code\n")
        handle.write(f"STOP.M {borehole.total_depth} : Stop depth\n")
        handle.write("~Curve Information\n")
        handle.write("DEPT.M : Depth\n")
        for curve in curves:
            handle.write(f"{curve.key.upper()}.{curve.unit} : {curve.label}\n")
        handle.write("~ASCII\n")
        for depth in depths:
            row = [f"{depth:.2f}"]
            for curve in curves:
                value = values.get((curve.key, depth))
                row.append("-999.25" if value is None else f"{value:.4f}")
            handle.write(" ".join(row) + "\n")

    job = ExportJob(
        borehole_id=borehole.id,
        export_type="curves_las",
        status="generated",
        file_path=_relative_to_repo(path),
        file_name=file_name,
        summary={
            "curve_count": len(curves),
            "sample_depth_count": len(depths),
            "las_version": "2.0",
            "export_profile": profile.name if profile else None,
            "export_settings": export_settings,
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def create_export(
    db: Session,
    borehole_id: int,
    export_type: str,
    *,
    export_profile_id: int | None = None,
    export_settings: dict | None = None,
) -> ExportJob:
    profile = _profile_for_export(db, export_type, export_profile_id)
    if export_type == "corrected_lithology_csv":
        return export_corrected_lithology_csv(db, borehole_id, profile=profile, export_settings=export_settings)
    if export_type == "corrected_lithology_xlsx":
        return export_corrected_lithology_xlsx(db, borehole_id, profile=profile, export_settings=export_settings)
    if export_type == "curves_csv":
        return export_curves_csv(db, borehole_id, profile=profile, export_settings=export_settings)
    if export_type == "curves_las":
        return export_curves_las(db, borehole_id, profile=profile, export_settings=export_settings)
    raise ValueError("Unsupported export type")


def list_exports(db: Session, borehole_id: int) -> list[ExportJob]:
    return list(
        db.scalars(
            select(ExportJob)
            .where(ExportJob.borehole_id == borehole_id)
            .order_by(ExportJob.created_at.desc(), ExportJob.id.desc())
        )
    )


def get_export_path(db: Session, export_job_id: int) -> Path:
    job = db.get(ExportJob, export_job_id)
    if job is None:
        raise ValueError("Export job not found")
    settings = get_settings()
    path = Path(job.file_path)
    return path if path.is_absolute() else settings.repo_root / path
