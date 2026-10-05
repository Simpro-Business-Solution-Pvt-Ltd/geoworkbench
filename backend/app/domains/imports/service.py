import csv
import json
import re
import shutil
import tempfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
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
from app.services.template_import import (
    inspect_workbook,
    is_tabular_template,
    read_template_dataset,
    template_matches,
    validate_template,
)
from app.services.curve_dictionary import curve_dictionary_mapping
from app.services.data_stage import RAW_IMPORTED, merge_stage_metadata


def default_import_profiles() -> list[ImportProfile]:
    return [
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
                "curve_dictionary": curve_dictionary_mapping(),
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


def ensure_default_profiles(db: Session) -> None:
    profiles = default_import_profiles()
    changed = False
    for profile in profiles:
        existing = db.scalar(select(ImportProfile).where(ImportProfile.name == profile.name))
        if existing is None:
            db.add(profile)
            changed = True
        elif refreshed_mapping := refreshed_default_import_mapping(existing, profile):
            existing.description = profile.description
            existing.mapping = refreshed_mapping
            db.add(existing)
            changed = True
    if changed:
        db.commit()


def refreshed_default_import_mapping(existing: ImportProfile, default: ImportProfile) -> dict | None:
    mapping = existing.mapping or {}
    if default.profile_type == "excel" and mapping.get("template_key") != default.mapping.get("template_key"):
        return default.mapping
    if default.profile_type == "las" and "curve_dictionary" not in mapping:
        return {**mapping, "curve_dictionary": curve_dictionary_mapping()}
    return None


def list_import_profiles(db: Session) -> list[ImportProfile]:
    ensure_default_profiles(db)
    return list(db.scalars(select(ImportProfile).order_by(ImportProfile.profile_type, ImportProfile.name)))


def builtin_import_profile_names() -> set[str]:
    return {profile.name for profile in default_import_profiles()}


def is_builtin_import_profile(profile: ImportProfile) -> bool:
    return profile.name in builtin_import_profile_names()


def _clean_template_name(db: Session, name: str | None, *, exclude_id: int | None = None) -> str:
    cleaned = (name or "").strip()
    if not cleaned:
        raise ValueError("Template name is required.")
    if cleaned in builtin_import_profile_names():
        raise ValueError(f'"{cleaned}" is a built-in template name. Choose another name.')
    clash = db.scalar(select(ImportProfile).where(ImportProfile.name == cleaned))
    if clash is not None and clash.id != exclude_id:
        raise ValueError(f'A template named "{cleaned}" already exists.')
    return cleaned


def create_import_profile(db: Session, *, name: str, description: str | None, mapping: dict) -> ImportProfile:
    template = validate_template(mapping)
    template["version"] = 1
    template["status"] = "active"
    profile = ImportProfile(
        name=_clean_template_name(db, name),
        profile_type="excel",
        description=(description or "").strip() or "Registry template for flat interval workbooks.",
        mapping=template,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


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
    if is_builtin_import_profile(profile):
        raise ValueError("Built-in templates are read-only. Create a new template instead.")
    if name is not None:
        profile.name = _clean_template_name(db, name, exclude_id=profile.id)
    if description is not None:
        profile.description = description
    if mapping is not None:
        template = validate_template(mapping)
        current = profile.mapping or {}
        # Every saved change is a new version; imports record the version they used.
        template["version"] = int(current.get("version", 1)) + 1
        template["status"] = current.get("status", "active")
        profile.mapping = template
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@contextmanager
def temporary_upload(file: UploadFile) -> Iterator[Path]:
    """Store an uploaded sample in a temp file that is deleted afterwards."""
    suffix = Path(file.filename or "sample.xlsx").suffix.lower() or ".xlsx"
    if suffix not in {".xlsx", ".xlsm"}:
        raise HTTPException(status_code=400, detail=f'Template samples must be .xlsx or .xlsm, not "{suffix}".')
    handle = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        with handle:
            shutil.copyfileobj(file.file, handle)
        yield Path(handle.name)
    finally:
        Path(handle.name).unlink(missing_ok=True)


def inspect_template_sample(path: Path) -> dict:
    return inspect_workbook(path)


def test_template_on_sample(path: Path, mapping_json: str, borehole_code: str | None) -> dict:
    try:
        mapping = json.loads(mapping_json)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Template JSON is not valid: {exc.msg} (line {exc.lineno}).") from exc
    template = validate_template(mapping)
    if not template_matches(path, template):
        missing_note = ", ".join(template["detect"]["required_headers"])
        raise ValueError(
            f"This sample would not be detected by the template: it needs all of these headers in row "
            f'{template["header_row"]}: {missing_note}.'
        )
    dataset = read_template_dataset(
        path,
        template,
        borehole_code=(borehole_code or "").strip() or None,
        template_label="Draft template",
    )
    return {"template": template, "profile": dataset["profile"]}


def set_import_profile_archived(db: Session, profile_id: int, archived: bool) -> ImportProfile:
    profile = db.get(ImportProfile, profile_id)
    if profile is None:
        raise ValueError("Import profile not found")
    if is_builtin_import_profile(profile):
        raise ValueError("Built-in templates cannot be archived.")
    profile.mapping = {**(profile.mapping or {}), "status": "archived" if archived else "active"}
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


NO_BUILTIN_TEMPLATE_MESSAGE = "No supported descriptive lithology template was detected."


def _registry_template_label(profile: ImportProfile, template: dict) -> str:
    return f"{profile.name} v{template.get('version', 1)}"


def _active_registry_templates(db: Session) -> list[tuple[ImportProfile, dict]]:
    templates = []
    for profile in db.scalars(select(ImportProfile).order_by(ImportProfile.name)):
        if not is_tabular_template(profile.mapping) or (profile.mapping or {}).get("status") == "archived":
            continue
        try:
            templates.append((profile, validate_template(profile.mapping)))
        except ValueError:
            continue
    return templates


def _profile_excel_source(db: Session, source_file: SourceFile, path: Path) -> dict:
    """Built-in CTSJ/PBH readers first, then active Template Registry templates."""
    try:
        return profile_excel_workbook(path)
    except ValueError as exc:
        if NO_BUILTIN_TEMPLATE_MESSAGE not in str(exc):
            raise

    matches = [(profile, template) for profile, template in _active_registry_templates(db) if template_matches(path, template)]
    if not matches:
        raise ValueError(
            "No built-in layout or Template Registry template matches this workbook. "
            "Create one in Import > Template Registry > New template."
        )
    # Most specific template wins: the one requiring the most headers.
    matches.sort(key=lambda item: len(item[1]["detect"]["required_headers"]), reverse=True)
    profile, template = matches[0]
    borehole = db.get(Borehole, source_file.borehole_id) if source_file.borehole_id else None
    label = _registry_template_label(profile, template)
    summary = read_template_dataset(
        path, template, borehole_code=borehole.code if borehole else None, template_label=label
    )["profile"]
    summary["registry_template"] = {
        "id": profile.id,
        "name": profile.name,
        "version": template.get("version", 1),
        "mapping": template,
    }
    if len(matches) > 1:
        summary["warnings"].append(
            "Also matched: " + ", ".join(item[0].name for item in matches[1:]) + f'. Used "{profile.name}".'
        )
    return summary


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
            summary = _profile_excel_source(db, source_file, absolute_path)
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

    # A file uploaded from a borehole's Import Center belongs to that borehole, so
    # import into it rather than the code written inside the workbook. Loading goes
    # through the regular merge path: it keeps the data in the selected borehole and
    # does not generate synthetic curves.
    if source_file.borehole_id is not None:
        # Importing loads the whole workbook, so replace rather than the merge default of
        # append_new_depths, which skips rows that overlap rows added earlier in the same file.
        source_file, borehole_id, _status, summary = merge_source_file_into_borehole(
            db, source_file_id, merge_options={"interval_mode": "replace_overlapping_range"}
        )
        target = db.get(Borehole, borehole_id)
        return source_file, borehole_id, target.code if target else "", summary

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
        # A file processed with a registry template merges with the exact template
        # snapshot it was previewed with, so a later template edit cannot change it.
        parse_summary = (source_file.file_metadata or {}).get("parse_summary") or {}
        registry_template = parse_summary.get("registry_template")
        if registry_template:
            source_code = (merge_options.get("source_borehole_code") or "").strip() or borehole.code
            dataset = read_template_dataset(
                absolute_path,
                registry_template["mapping"],
                borehole_code=source_code,
                template_label=f"{registry_template['name']} v{registry_template['version']}",
            )
            if not dataset["lithologyIntervals"]:
                raise ValueError(
                    f'No rows for borehole "{source_code}" in this file. '
                    "Open Merge and choose which file borehole's rows to load."
                )
        else:
            dataset = normalize_excel_workbook(absolute_path)
        profile = dataset["profile"]
        supported_templates = {"pbh_descriptive_v1", "ctsj_descriptive_v1"}
        template_key = profile.get("template", {}).get("key")
        if template_key in supported_templates or registry_template:
            interval_mode = merge_options.get("interval_mode") or (
                "replace_overlapping_range" if borehole.lithology_intervals else "append_new_depths"
            )
            incoming_from = min((item["fromDepth"] for item in dataset["lithologyIntervals"]), default=0)
            incoming_to = max((item["toDepth"] for item in dataset["lithologyIntervals"]), default=0)
            range_from = float(merge_options.get("from_depth", incoming_from))
            range_to = float(merge_options.get("to_depth", incoming_to))

            if interval_mode == "replace_overlapping_range":
                # Remove from the collection as well as the session: rows left in
                # borehole.lithology_intervals after db.delete() make the later
                # db.add(borehole) fail with "Instance ... has been deleted".
                for interval in list(borehole.lithology_intervals):
                    if _overlaps(interval.from_depth, interval.to_depth, range_from, range_to):
                        borehole.lithology_intervals.remove(interval)
                        db.delete(interval)
                for seam in list(borehole.seam_intervals):
                    if _overlaps(seam.from_depth, seam.to_depth, range_from, range_to):
                        borehole.seam_intervals.remove(seam)
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
                        recovery_percent=item["recoveryPercent"]
                        if item.get("recoveryPercent") is not None
                        else (
                            round((item["recovery"] / item["thickness"]) * 100, 2)
                            if item.get("recovery") is not None and item.get("thickness")
                            else None
                        ),
                        rqd=item.get("rqd"),
                        structural_features=item.get("structuralFeatures"),
                        remark=item.get("remark"),
                        attributes=merge_stage_metadata(
                            {
                                "lithology_source": item.get("lithologySource"),
                                "grain_size": item.get("grainSize"),
                                "core_dip": item.get("coreDip"),
                                "rqd_source": item.get("rqdSource"),
                                "rqd_piece_lengths": item.get("rqdPieceLengths"),
                            },
                            RAW_IMPORTED,
                            source_type="excel",
                            source_name=source_file.original_name,
                        ),
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
                        attributes=merge_stage_metadata(
                            {"source_row": item.get("sourceRow")},
                            RAW_IMPORTED,
                            source_type="excel",
                            source_name=source_file.original_name,
                        ),
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
                "merge_options": {
                    "interval_mode": interval_mode,
                    **({"source_borehole_code": source_code} if registry_template else {}),
                },
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
