import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.init_db import init_db  # noqa: E402
from app.db.models import Borehole, FieldSubmission, SourceFile  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.domains.imports.service import (  # noqa: E402
    ensure_default_profiles,
    merge_source_file_into_borehole,
    process_source_file,
)
from app.services.excel_import import import_excel_workbook, profile_excel_workbook  # noqa: E402


def _relative(repo_root: Path, path: Path) -> str:
    return str(path.resolve().relative_to(repo_root.resolve()))


def _register_source_file(
    db,
    repo_root: Path,
    *,
    borehole: Borehole | None,
    path: Path,
    file_type: str,
    status: str = "uploaded",
    metadata: dict | None = None,
) -> SourceFile:
    relative_path = _relative(repo_root, path)
    existing = db.scalar(
        select(SourceFile)
        .where(SourceFile.original_name == path.name)
        .where(SourceFile.storage_path == relative_path)
        .where(SourceFile.borehole_id == (borehole.id if borehole else None))
    )
    if existing is not None:
        existing.file_type = file_type
        existing.status = status
        existing.file_metadata = {**(existing.file_metadata or {}), **(metadata or {})}
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    source_file = SourceFile(
        borehole_id=borehole.id if borehole else None,
        file_type=file_type,
        original_name=path.name,
        storage_path=relative_path,
        status=status,
        file_metadata=metadata or {},
    )
    db.add(source_file)
    db.commit()
    db.refresh(source_file)
    return source_file


def _seed_base_demo() -> list[str]:
    from seed_demo import main as seed_demo_main
    from seed_synthetic_coal_block import main as seed_synthetic_main

    notes: list[str] = []
    seed_demo_main()
    notes.append("PBH batch/mobile demo boreholes are available.")
    seed_synthetic_main()
    notes.append("Five synthetic correlation boreholes and matching Excel/LAS fixtures are available.")
    return notes


def _try_generate_core_strips() -> dict:
    try:
        from generate_core_strips import main as generate_core_strips_main

        generate_core_strips_main()
        return {"status": "generated", "method": "manual_relative_four_lane_crop_v1"}
    except Exception as exc:  # pragma: no cover - script diagnostic path
        return {"status": "skipped", "reason": str(exc)}


def _add_mobile_submission(db, borehole: Borehole) -> None:
    exists = any(
        submission.submission_type == "mobile_runtime_interval"
        for submission in borehole.field_submissions
    )
    if exists:
        return
    borehole.field_submissions.append(
        FieldSubmission(
            submission_type="mobile_runtime_interval",
            status="synced",
            submitted_by="field-demo-user",
            payload={
                "depth_from": 186.0,
                "depth_to": 191.5,
                "lithology_code": "COAL",
                "lithology_label": "Coal with shale parting",
                "recovery_m": 4.8,
                "runtime_parameters": [
                    {"name": "Drill fluid loss", "value": "minor", "unit": ""},
                    {"name": "Bit depth", "value": 191.5, "unit": "m"},
                    {"name": "Hole depth", "value": 191.7, "unit": "m"},
                    {"name": "Water level", "value": 18.4, "unit": "m"},
                ],
                "attachments": [
                    {"type": "corebox_photo", "status": "uploaded_pending_depth_mapping"},
                    {"type": "las", "status": "merged_when_verified"},
                ],
            },
        )
    )
    db.add(borehole)
    db.commit()


def _prepare_customer_inputs(db, repo_root: Path) -> list[dict]:
    prepared: list[dict] = []
    excel_files = [
        repo_root / "DOC-20260510-WA0000..xlsx",
        repo_root / "DESCRIPTIVE LITHOLOGY CTSJ-30 (P-02) Running.xlsx",
    ]
    for workbook in excel_files:
        if not workbook.exists():
            prepared.append({"file": workbook.name, "status": "missing"})
            continue
        borehole = import_excel_workbook(db, workbook)
        profile = profile_excel_workbook(workbook)
        source = _register_source_file(
            db,
            repo_root,
            borehole=borehole,
            path=workbook,
            file_type="excel",
            status="imported",
            metadata={
                "parse_summary": profile,
                "demo_note": "Imported from customer-shared workbook template.",
            },
        )
        _add_mobile_submission(db, borehole)
        prepared.append(
            {
                "file": workbook.name,
                "borehole": borehole.code,
                "source_file_id": source.id,
                "status": "imported",
                "template": profile.get("template", {}).get("key"),
            }
        )

    ctsj = db.scalar(select(Borehole).where(Borehole.code.like("CTSJ%")))
    las_path = repo_root / "CTSJ-02 P-27 COMPOSITE.las"
    if ctsj is not None and las_path.exists():
        source = _register_source_file(
            db,
            repo_root,
            borehole=ctsj,
            path=las_path,
            file_type="las",
            status="uploaded",
            metadata={
                "demo_note": (
                    "LAS file is customer-shared but not guaranteed to belong to the same "
                    "borehole as the descriptive workbook. It is merged for workflow demonstration."
                )
            },
        )
        process_source_file(db, source.id)
        source, _, status, summary = merge_source_file_into_borehole(db, source.id)
        prepared.append(
            {
                "file": las_path.name,
                "borehole": ctsj.code,
                "source_file_id": source.id,
                "status": status,
                "curves": [curve["key"] for curve in summary.get("curves", [])],
                "demo_alignment_note": "not_confirmed_same_borehole",
            }
        )
    return prepared


def _register_synthetic_sources(db, repo_root: Path) -> list[dict]:
    registered: list[dict] = []
    root = repo_root / "sample-data" / "demo-coal-block" / "boreholes"
    for borehole in db.scalars(select(Borehole).where(Borehole.code.like("DMBH-%"))):
        folder = root / borehole.code
        for path, file_type in [
            (folder / f"{borehole.code}-descriptive-log.xlsx", "excel"),
            (folder / f"{borehole.code}-geophysical.las", "las"),
        ]:
            if not path.exists():
                continue
            source = _register_source_file(
                db,
                repo_root,
                borehole=borehole,
                path=path,
                file_type=file_type,
                status="merged",
                metadata={
                    "demo_note": "Generated fitting dataset for correlation, rules, and AI insight demonstrations."
                },
            )
            registered.append(
                {
                    "borehole": borehole.code,
                    "file": path.name,
                    "type": file_type,
                    "source_file_id": source.id,
                }
            )
    return registered


def main() -> None:
    repo_root = Path(__file__).resolve().parents[2]
    init_db()
    manifest = {
        "prepared_at": datetime.now(timezone.utc).isoformat(),
        "purpose": "Reliance stakeholder demo data preparation",
        "notes": [],
        "customer_inputs": [],
        "synthetic_correlation_sources": [],
        "core_strips": {},
    }

    manifest["notes"].extend(_seed_base_demo())
    db = SessionLocal()
    try:
        ensure_default_profiles(db)
        manifest["customer_inputs"] = _prepare_customer_inputs(db, repo_root)
        manifest["synthetic_correlation_sources"] = _register_synthetic_sources(db, repo_root)
    finally:
        db.close()

    manifest["core_strips"] = _try_generate_core_strips()
    output_path = repo_root / "runtime-data" / "demo-prep" / "reliance-demo-manifest.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {output_path}")
    print(
        "Prepared demo inputs: "
        f"{len(manifest['customer_inputs'])} customer source(s), "
        f"{len(manifest['synthetic_correlation_sources'])} generated correlation source(s)."
    )


if __name__ == "__main__":
    main()
