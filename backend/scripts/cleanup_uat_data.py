import argparse
import json
import sys
from dataclasses import asdict, dataclass
from pathlib import Path

from sqlalchemy import select

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(REPO_ROOT / "backend"))

from app.db.init_db import init_db  # noqa: E402
from app.db.models import (  # noqa: E402
    AiSuggestion,
    Borehole,
    CoreImage,
    CorrectionAudit,
    CorrelationObservation,
    Curve,
    CurveSample,
    DisplayLayout,
    ExportJob,
    FieldSubmission,
    LithologyInterval,
    Project,
    SeamInterval,
    Site,
    SourceFile,
    SourceImport,
    ValidationIssue,
)
from app.db.session import SessionLocal  # noqa: E402


DEMO_PROJECT_CODES = ("DEMO-COAL", "DEMO-COAL-BLOCK", "RAHAM-COAL")
DEMO_BOREHOLE_PREFIXES = ("PBH-", "CTSJ-", "IMPORT-DEMO-", "SPNG-")


@dataclass
class CleanupPlan:
    project_codes: list[str]
    borehole_prefixes: list[str]
    borehole_ids: list[int]
    borehole_codes: list[str]
    deleted_counts: dict[str, int]
    dry_run: bool


def _delete_count(query, *, dry_run: bool) -> int:
    count = query.count()
    if not dry_run and count:
        query.delete(synchronize_session=False)
    return count


def _target_boreholes(project_codes: list[str], borehole_prefixes: list[str]) -> list[Borehole]:
    with SessionLocal() as db:
        boreholes = (
            db.scalars(
                select(Borehole)
                .join(Site)
                .join(Project)
                .where(Project.code.in_(project_codes))
                .order_by(Borehole.code)
            )
            .unique()
            .all()
        )
        known_ids = {borehole.id for borehole in boreholes}
        if borehole_prefixes:
            for borehole in db.scalars(select(Borehole).order_by(Borehole.code)).all():
                if borehole.id in known_ids:
                    continue
                if any(borehole.code.upper().startswith(prefix.upper()) for prefix in borehole_prefixes):
                    boreholes.append(borehole)
                    known_ids.add(borehole.id)
        return boreholes


def cleanup_uat_data(
    *,
    project_codes: list[str],
    borehole_prefixes: list[str],
    dry_run: bool,
    clear_observations: bool,
) -> CleanupPlan:
    init_db()
    targets = _target_boreholes(project_codes, borehole_prefixes)
    borehole_ids = [borehole.id for borehole in targets]
    borehole_codes = [borehole.code for borehole in targets]
    counts: dict[str, int] = {}
    if not borehole_ids:
        return CleanupPlan(project_codes, borehole_prefixes, [], [], counts, dry_run)

    with SessionLocal() as db:
        curve_ids = [
            curve_id
            for curve_id in db.scalars(select(Curve.id).where(Curve.borehole_id.in_(borehole_ids))).all()
        ]
        interval_ids = [
            interval_id
            for interval_id in db.scalars(
                select(LithologyInterval.id).where(LithologyInterval.borehole_id.in_(borehole_ids))
            ).all()
        ]
        counts["curve_samples"] = (
            _delete_count(db.query(CurveSample).filter(CurveSample.curve_id.in_(curve_ids)), dry_run=dry_run)
            if curve_ids
            else 0
        )
        audit_query = db.query(CorrectionAudit).filter(CorrectionAudit.borehole_id.in_(borehole_ids))
        if interval_ids:
            audit_query = db.query(CorrectionAudit).filter(
                (CorrectionAudit.borehole_id.in_(borehole_ids))
                | CorrectionAudit.interval_id.in_(interval_ids)
            )
        counts["correction_audits"] = _delete_count(audit_query, dry_run=dry_run)
        counts["ai_suggestions"] = _delete_count(
            db.query(AiSuggestion).filter(AiSuggestion.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["validation_issues"] = _delete_count(
            db.query(ValidationIssue).filter(ValidationIssue.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["source_files"] = _delete_count(
            db.query(SourceFile).filter(SourceFile.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["source_imports"] = _delete_count(
            db.query(SourceImport).filter(SourceImport.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["field_submissions"] = _delete_count(
            db.query(FieldSubmission).filter(FieldSubmission.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["export_jobs"] = _delete_count(
            db.query(ExportJob).filter(ExportJob.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["display_layouts"] = _delete_count(
            db.query(DisplayLayout).filter(DisplayLayout.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["core_images"] = _delete_count(
            db.query(CoreImage).filter(CoreImage.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["seam_intervals"] = _delete_count(
            db.query(SeamInterval).filter(SeamInterval.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["lithology_intervals"] = _delete_count(
            db.query(LithologyInterval).filter(LithologyInterval.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )
        counts["curves"] = _delete_count(
            db.query(Curve).filter(Curve.borehole_id.in_(borehole_ids)),
            dry_run=dry_run,
        )

        observations = db.scalars(select(CorrelationObservation)).all() if clear_observations else []
        stale_observations = [
            observation
            for observation in observations
            if set(observation.borehole_ids or []).intersection(borehole_ids)
        ]
        counts["correlation_observations"] = len(stale_observations)
        if not dry_run:
            for observation in stale_observations:
                db.delete(observation)

        counts["boreholes"] = _delete_count(
            db.query(Borehole).filter(Borehole.id.in_(borehole_ids)),
            dry_run=dry_run,
        )

        if not dry_run:
            empty_sites = db.scalars(select(Site).join(Project).where(Project.code.in_(project_codes))).all()
            for site in empty_sites:
                remaining = db.scalar(select(Borehole.id).where(Borehole.site_id == site.id).limit(1))
                if remaining is None:
                    db.delete(site)
            db.flush()
            for project in db.scalars(select(Project).where(Project.code.in_(project_codes))).all():
                remaining = db.scalar(select(Site.id).where(Site.project_id == project.id).limit(1))
                if remaining is None:
                    db.delete(project)
            db.commit()

    return CleanupPlan(project_codes, borehole_prefixes, borehole_ids, borehole_codes, counts, dry_run)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remove demo/test geology data before importing Reliance UAT data."
    )
    parser.add_argument(
        "--project-code",
        action="append",
        dest="project_codes",
        help="Project code to purge. Can be supplied multiple times.",
    )
    parser.add_argument(
        "--borehole-prefix",
        action="append",
        dest="borehole_prefixes",
        help="Standalone borehole code prefix to purge. Can be supplied multiple times.",
    )
    parser.add_argument(
        "--keep-standalone-prefixes",
        action="store_true",
        help="Only purge configured demo projects; do not purge standalone PBH/CTSJ/SPNG-style boreholes.",
    )
    parser.add_argument(
        "--keep-correlation-observations",
        action="store_true",
        help="Keep saved correlation observations even if they reference purged boreholes.",
    )
    parser.add_argument("--apply", action="store_true", help="Apply deletion. Omit for dry-run.")
    args = parser.parse_args()

    project_codes = args.project_codes or list(DEMO_PROJECT_CODES)
    borehole_prefixes = [] if args.keep_standalone_prefixes else (
        args.borehole_prefixes or list(DEMO_BOREHOLE_PREFIXES)
    )
    result = cleanup_uat_data(
        project_codes=project_codes,
        borehole_prefixes=borehole_prefixes,
        dry_run=not args.apply,
        clear_observations=not args.keep_correlation_observations,
    )
    print(json.dumps(asdict(result), indent=2))
    if result.dry_run:
        print("Dry run only. Re-run with --apply to delete the listed demo/test data.")


if __name__ == "__main__":
    main()
