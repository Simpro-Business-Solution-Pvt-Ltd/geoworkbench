import csv
import re
import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Borehole, LithologyInterval, SeamInterval, SourceImport, ImportProfile, SourceFile
from app.domains.imports.schemas import SourceFileCreate
from app.services.excel_import import normalize_excel_workbook, import_excel_workbook, profile_excel_workbook
from app.services.geophysical_pdf_import import (
    import_digitized_pdf_curves,
    profile_pinnacle_composite_pdf,
)
from app.services.las_import import import_las_curves, profile_las_file


def ensure_default_profiles(db: Session) -> None:
    profiles = [
        ImportProfile(
            name="PBH Excel Workbook",
            profile_type="excel",
            description="Profile detected from PBH descriptive lithology workbook.",
            mapping={
                "template_key": "pbh_descriptive_v1",
                "sheet_detection": ["Lithology depth", "Description As Per Core Recovery"],
                "header_rows": [9, 10, 11],
                "data_start_row": 12,
                "lithology": {
                    "from_depth": "E",
                    "thickness": "F",
                    "recovery": "G",
                    "lithology_code": "H",
                    "logged_color": "I",
                    "structural_features": "J",
                    "core_dip": "K",
                    "seam_name": "L",
                    "rqd_fraction": "M",
                    "remark": "N",
                },
                "status": "active_profile",
            },
        ),
        ImportProfile(
            name="CTSJ Excel Workbook",
            profile_type="excel",
            description="Profile detected from CTSJ descriptive lithology workbook.",
            mapping={
                "template_key": "ctsj_descriptive_v1",
                "sheet_detection": ["DRILLING RUN", "DEPTH & THICKNESS AFTER ADJUSTMENT"],
                "header_rows": [7, 8],
                "data_start_row": 9,
                "lithology": {
                    "from_depth": "F",
                    "thickness": "G",
                    "recovery": "H",
                    "lithology_code": "I",
                    "grain_size": "J",
                    "logged_color": "K",
                    "rqd_piece_lengths": "L",
                    "rqd_percent": "M",
                    "structural_features": "N",
                    "core_dip": "O",
                    "seam_name": "P",
                    "remark": "Q",
                },
                "status": "active_profile",
            },
        ),
        ImportProfile(
            name="LAS Geophysical Curves",
            profile_type="las",
            description="Generic LAS curve import profile for depth-indexed geophysical logs.",
            mapping={
                "depth": "DEPT",
                "curves": ["GR", "RHOB", "RES", "CALI", "DT"],
                "status": "draft_profile",
            },
        ),
        ImportProfile(
            name="Pinnacle Composite PDF",
            profile_type="geophysical_pdf",
            description=(
                "Digitizes plotted vector curves from a Pinnacle composite PDF when raw "
                "LAS/CSV is unavailable."
            ),
            mapping={
                "template_key": "pinnacle_composite_pdf_v1",
                "depth_axis": "embedded_depth_labels",
                "tracks": {
                    "left": ["CALP", "NGAM", "SP", "INCL"],
                    "right": ["HRD", "RES", "DENS", "SPR"],
                },
                "status": "review_profile",
            },
        ),
        ImportProfile(
            name="Corebox Image Folder",
            profile_type="images",
            description="Core image folder/profile with manual or inferred box-depth mapping.",
            mapping={"box_number": "filename_number", "depth_mapping": "manual_or_inferred"},
        ),
    ]
    changed = False
    for profile in profiles:
        existing = db.scalar(select(ImportProfile).where(ImportProfile.name == profile.name))
        if existing is None:
            db.add(profile)
            changed = True
        elif profile.profile_type == "excel" and existing.mapping.get("template_key") != profile.mapping.get("template_key"):
            existing.description = profile.description
            existing.mapping = profile.mapping
            db.add(existing)
            changed = True
    if changed:
        db.commit()


def list_import_profiles(db: Session) -> list[ImportProfile]:
    ensure_default_profiles(db)
    return list(db.scalars(select(ImportProfile).order_by(ImportProfile.profile_type, ImportProfile.name)))


def update_import_profile(
    db: Session,
    profile_id: int,
    *,
    name: str | None = None,
    description: str | None = None,
    mapping: dict | None = None,
) -> ImportProfile:
    profile = db.get(ImportProfile, profile_id)
    if profile is None:
        raise ValueError("Import profile not found")
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


def create_source_file(db: Session, payload: SourceFileCreate) -> SourceFile:
    source_file = SourceFile(
        borehole_id=payload.borehole_id,
        file_type=payload.file_type,
        original_name=payload.original_name,
        storage_path=payload.storage_path,
        status="uploaded",
        file_metadata=payload.file_metadata,
    )
    db.add(source_file)
    db.commit()
    db.refresh(source_file)
    return source_file


def safe_filename(filename: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(filename).name).strip("._")
    return clean or "upload.bin"


def upload_source_file(
    db: Session,
    file: UploadFile,
    file_type: str,
    borehole_id: int | None,
) -> SourceFile:
    settings = get_settings()
    if settings.upload_root is None:
        raise RuntimeError("Upload root is not configured")

    clean_name = safe_filename(file.filename or "upload.bin")
    relative_dir = Path("unassigned" if borehole_id is None else f"borehole-{borehole_id}")
    target_dir = settings.upload_root / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{uuid4().hex}-{clean_name}"

    with target_path.open("wb") as output:
        shutil.copyfileobj(file.file, output)

    source_file = SourceFile(
        borehole_id=borehole_id,
        file_type=file_type,
        original_name=clean_name,
        storage_path=str(target_path.relative_to(settings.repo_root)),
        status="uploaded",
        file_metadata={
            "content_type": file.content_type,
            "storage_mode": "local",
            "size_bytes": target_path.stat().st_size,
        },
    )
    db.add(source_file)
    db.commit()
    db.refresh(source_file)
    return source_file


def list_source_files(db: Session, borehole_id: int | None = None) -> list[SourceFile]:
    stmt = select(SourceFile).order_by(SourceFile.uploaded_at.desc(), SourceFile.id.desc())
    if borehole_id is not None:
        stmt = stmt.where(SourceFile.borehole_id == borehole_id)
    return list(db.scalars(stmt))


def update_source_file_status(db: Session, source_file_id: int, status: str) -> SourceFile:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise ValueError("Source file not found")
    source_file.status = status
    db.add(source_file)
    db.commit()
    db.refresh(source_file)
    return source_file


def preview_delimited_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        dialect = csv.Sniffer().sniff(sample) if sample.strip() else csv.excel
        reader = csv.DictReader(handle, dialect=dialect)
        rows = []
        for index, row in enumerate(reader):
            if index < 5:
                rows.append(row)
            else:
                break
        row_count = index + 1 if "index" in locals() else 0
        for _ in reader:
            row_count += 1
        return {
            "columns": reader.fieldnames or [],
            "preview_rows": rows,
            "row_count": row_count,
            "parser": "csv_preview",
        }


def process_source_file(db: Session, source_file_id: int) -> tuple[SourceFile, SourceImport, dict]:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise ValueError("Source file not found")

    settings = get_settings()
    storage_path = Path(source_file.storage_path)
    absolute_path = storage_path if storage_path.is_absolute() else settings.repo_root / storage_path
    source_file.status = "parsing"

    summary: dict
    try:
        suffix = absolute_path.suffix.lower()
        if suffix in {".csv", ".txt"}:
            summary = preview_delimited_file(absolute_path)
        elif suffix in {".xlsx", ".xlsm"}:
            summary = profile_excel_workbook(absolute_path)
        elif suffix == ".las" or source_file.file_type == "las":
            summary = profile_las_file(absolute_path)
        elif suffix == ".pdf" and source_file.file_type in {"geophysical_pdf", "pinnacle_pdf"}:
            summary = profile_pinnacle_composite_pdf(absolute_path)
        else:
            summary = {
                "parser": "metadata_only",
                "message": "Parser not implemented yet for this file type.",
                "extension": suffix,
            }
        status = "parsed" if summary.get("parser") != "metadata_only" else "registered"
    except Exception as exc:
        summary = {"parser": "failed", "error": str(exc)}
        status = "failed"

    source_file.status = status
    source_file.file_metadata = {**(source_file.file_metadata or {}), "parse_summary": summary}
    source_import = SourceImport(
        borehole_id=source_file.borehole_id,
        import_type=source_file.file_type,
        source_name=source_file.original_name,
        status=status,
        summary=summary,
    )
    db.add(source_file)
    db.add(source_import)
    db.flush()
    source_file.source_import_id = source_import.id
    db.commit()
    db.refresh(source_file)
    db.refresh(source_import)
    return source_file, source_import, summary


def import_source_file_as_borehole(db: Session, source_file_id: int) -> tuple[SourceFile, int, str, dict]:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise ValueError("Source file not found")

    settings = get_settings()
    storage_path = Path(source_file.storage_path)
    absolute_path = storage_path if storage_path.is_absolute() else settings.repo_root / storage_path
    if absolute_path.suffix.lower() not in {".xlsx", ".xlsm"}:
        raise ValueError("Only supported Excel workbooks can be imported as boreholes.")

    borehole = import_excel_workbook(db, absolute_path)
    source_file.borehole_id = borehole.id
    source_file.status = "imported"
    source_file.file_metadata = {
        **(source_file.file_metadata or {}),
        "imported_borehole_code": borehole.code,
    }
    db.add(source_file)
    db.commit()
    db.refresh(source_file)
    return source_file, borehole.id, borehole.code, profile_excel_workbook(absolute_path)


def _overlaps(from_depth: float, to_depth: float, range_from: float, range_to: float) -> bool:
    return from_depth < range_to and to_depth > range_from


def merge_source_file_into_borehole(
    db: Session,
    source_file_id: int,
    merge_options: dict | None = None,
) -> tuple[SourceFile, int, str, dict]:
    source_file = db.get(SourceFile, source_file_id)
    if source_file is None:
        raise ValueError("Source file not found")
    if source_file.borehole_id is None:
        raise ValueError("Source file is not associated with a borehole")

    borehole = db.get(Borehole, source_file.borehole_id)
    if borehole is None:
        raise ValueError("Associated borehole not found")

    settings = get_settings()
    storage_path = Path(source_file.storage_path)
    absolute_path = storage_path if storage_path.is_absolute() else settings.repo_root / storage_path
    suffix = absolute_path.suffix.lower()
    merge_options = merge_options or {}

    if suffix == ".las" or source_file.file_type == "las":
        curve_mode = merge_options.get("curve_mode") or "replace_curves_by_key"
        summary = import_las_curves(
            db,
            borehole,
            absolute_path,
            replace_existing=curve_mode == "replace_curves_by_key",
        )
        summary["merge_options"] = {"curve_mode": curve_mode}
        source_file.status = "merged"
        source_file.file_metadata = {**(source_file.file_metadata or {}), "merge_summary": summary}
        db.add(source_file)
        db.commit()
        db.refresh(source_file)
        return source_file, borehole.id, "merged", summary

    if suffix == ".pdf" and source_file.file_type in {"geophysical_pdf", "pinnacle_pdf"}:
        curve_mode = merge_options.get("curve_mode") or "replace_curves_by_key"
        result = import_digitized_pdf_curves(
            db,
            borehole,
            absolute_path,
            replace_existing=curve_mode == "replace_curves_by_key",
        )
        summary = {
            "merge_mode": "digitized_pdf_curves",
            "message": "Digitized geophysical PDF curves were merged into the current borehole.",
            "curves": [
                {"key": curve["key"], "label": curve["label"], "samples": len(curve["samples"])}
                for curve in result["digitized_curves"]
            ],
            "limitations": result["limitations"],
            "merge_options": {"curve_mode": curve_mode},
        }
        source_file.status = "merged"
        source_file.file_metadata = {**(source_file.file_metadata or {}), "merge_summary": summary}
        db.add(source_file)
        db.commit()
        db.refresh(source_file)
        return source_file, borehole.id, "merged", summary

    if suffix in {".xlsx", ".xlsm"}:
        dataset = normalize_excel_workbook(absolute_path)
        profile = dataset["profile"]
        supported_templates = {"pbh_descriptive_v1", "ctsj_descriptive_v1"}
        template_key = profile.get("template", {}).get("key")
        if template_key in supported_templates:
            interval_mode = merge_options.get("interval_mode") or (
                "replace_overlapping_range" if borehole.lithology_intervals else "append_new_depths"
            )
            incoming_from = min((item["fromDepth"] for item in dataset["lithologyIntervals"]), default=0)
            incoming_to = max((item["toDepth"] for item in dataset["lithologyIntervals"]), default=0)
            range_from = float(merge_options.get("from_depth", incoming_from))
            range_to = float(merge_options.get("to_depth", incoming_to))

            if interval_mode == "replace_overlapping_range":
                for interval in list(borehole.lithology_intervals):
                    if _overlaps(interval.from_depth, interval.to_depth, range_from, range_to):
                        db.delete(interval)
                for seam in list(borehole.seam_intervals):
                    if _overlaps(seam.from_depth, seam.to_depth, range_from, range_to):
                        db.delete(seam)
                db.flush()

            code = borehole.code.lower()
            inserted_intervals = 0
            skipped_intervals = 0
            for item in dataset["lithologyIntervals"]:
                if not _overlaps(item["fromDepth"], item["toDepth"], range_from, range_to):
                    continue
                if interval_mode == "append_new_depths" and any(
                    _overlaps(existing.from_depth, existing.to_depth, item["fromDepth"], item["toDepth"])
                    for existing in borehole.lithology_intervals
                ):
                    skipped_intervals += 1
                    continue
                borehole.lithology_intervals.append(
                    LithologyInterval(
                        id=f"{code}-excel-lith-{source_file.id}-{item['sourceRow']}",
                        source_row=item.get("sourceRow"),
                        from_depth=item["fromDepth"],
                        to_depth=item["toDepth"],
                        lithology_code=item["lithologyCode"],
                        lithology_label=item["lithologyLabel"],
                        display_color=item.get("displayColor"),
                        logged_color=item.get("loggedColor"),
                        seam_name=item.get("seamName"),
                        recovery=item.get("recovery"),
                        recovery_percent=round((item["recovery"] / item["thickness"]) * 100, 2)
                        if item.get("recovery") is not None and item.get("thickness")
                        else None,
                        rqd=item.get("rqd"),
                        structural_features=item.get("structuralFeatures"),
                        remark=item.get("remark"),
                        attributes={
                            "lithology_source": item.get("lithologySource"),
                            "grain_size": item.get("grainSize"),
                            "core_dip": item.get("coreDip"),
                            "rqd_source": item.get("rqdSource"),
                            "rqd_piece_lengths": item.get("rqdPieceLengths"),
                        },
                    )
                )
                inserted_intervals += 1
            inserted_seams = 0
            for item in dataset["seamIntervals"]:
                if not _overlaps(item["fromDepth"], item["toDepth"], range_from, range_to):
                    continue
                if interval_mode == "append_new_depths" and any(
                    _overlaps(existing.from_depth, existing.to_depth, item["fromDepth"], item["toDepth"])
                    for existing in borehole.seam_intervals
                ):
                    continue
                borehole.seam_intervals.append(
                    SeamInterval(
                        id=f"{code}-excel-seam-{source_file.id}-{item['sourceRow']}",
                        source_row=item.get("sourceRow"),
                        name=item["name"],
                        from_depth=item["fromDepth"],
                        to_depth=item["toDepth"],
                        thickness=item.get("thickness"),
                        lithology_code=item.get("lithologyCode"),
                        lithology_label=item.get("lithologyLabel"),
                        attributes={"source_row": item.get("sourceRow")},
                    )
                )
                inserted_seams += 1
            borehole.total_depth = max(borehole.total_depth, dataset["borehole"]["totalDepth"])
            borehole.source_workbook = source_file.original_name
            borehole.source_sheet = dataset["borehole"].get("sourceSheet")
            borehole.workflow_status = "imported_with_excel_merge"
            summary = {
                "merge_mode": "known_excel_template_first_log",
                "message": "Known Excel template was merged into the interpreted log.",
                "template": template_key,
                "lithology_intervals": inserted_intervals,
                "seam_intervals": inserted_seams,
                "skipped_intervals": skipped_intervals,
                "range": {"from_depth": range_from, "to_depth": range_to},
                "merge_options": {"interval_mode": interval_mode},
                "profile": profile,
            }
            source_file.status = "merged"
            source_file.file_metadata = {**(source_file.file_metadata or {}), "merge_summary": summary}
            source_import = SourceImport(
                borehole_id=borehole.id,
                import_type="excel_merge",
                source_name=source_file.original_name,
                status="merged",
                summary=summary,
            )
            db.add(borehole)
            db.add(source_file)
            db.add(source_import)
            db.commit()
            db.refresh(source_file)
            return source_file, borehole.id, "merged", summary

        summary = {
            "merge_mode": "profile_only_pending_review",
            "message": (
                "Excel was profiled and linked to this borehole. Automatic merge into an "
                "existing interpreted log is pending template-specific review rules."
            ),
            "profile": profile,
        }
        source_file.status = "merge_pending_review"
        source_file.file_metadata = {**(source_file.file_metadata or {}), "merge_summary": summary}
        source_import = SourceImport(
            borehole_id=borehole.id,
            import_type="excel_merge_pending",
            source_name=source_file.original_name,
            status="merge_pending_review",
            summary=summary,
        )
        db.add(source_file)
        db.add(source_import)
        db.commit()
        db.refresh(source_file)
        return source_file, borehole.id, "merge_pending_review", summary

    if source_file.file_type in {"corebox_image", "site_photo", "images"}:
        summary = {
            "merge_mode": "stored_as_borehole_file",
            "message": (
                "Image file is stored against this borehole. Depth-to-corebox mapping should be "
                "confirmed before it becomes an interval-linked core image."
            ),
        }
        source_file.status = "linked_pending_depth_mapping"
        source_file.file_metadata = {**(source_file.file_metadata or {}), "merge_summary": summary}
        db.add(source_file)
        db.commit()
        db.refresh(source_file)
        return source_file, borehole.id, "linked_pending_depth_mapping", summary

    if suffix in {".csv", ".txt"}:
        summary = {
            "merge_mode": "preview_only_pending_mapping",
            "message": "Delimited file was profiled. Column mapping is required before merge.",
            "preview": preview_delimited_file(absolute_path),
        }
        source_file.status = "mapping_required"
        source_file.file_metadata = {**(source_file.file_metadata or {}), "merge_summary": summary}
        db.add(source_file)
        db.commit()
        db.refresh(source_file)
        return source_file, borehole.id, "mapping_required", summary

    raise ValueError("No merge adapter is available for this file type yet.")
