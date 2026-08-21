import csv
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Borehole, Curve, CurveSample, ExportProfile, Project, Site
from app.db.session import Base
from app.domains.exports.service import export_curves_csv


def test_curves_csv_export_writes_selected_curves_and_depth_window(tmp_path: Path) -> None:
    db = _test_session()
    settings = get_settings()
    original_repo_root = settings.repo_root
    original_export_root = settings.export_root
    settings.repo_root = tmp_path
    settings.export_root = tmp_path / "exports"
    try:
        borehole = _seed_borehole_with_curves(db)
        profile = ExportProfile(
            name="Natural Gamma Only",
            export_type="curves_csv",
            mapping={"curves": ["ngamma"]},
        )

        job = export_curves_csv(
            db,
            borehole.id,
            profile=profile,
            export_settings={"from_depth": 1.0, "to_depth": 2.0},
        )

        output_path = tmp_path / job.file_path
        with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        assert job.status == "generated"
        assert job.summary["curve_count"] == 1
        assert job.summary["sample_depth_count"] == 2
        assert rows == [
            {"depth": "1.0", "ngamma": "42.0"},
            {"depth": "2.0", "ngamma": "48.0"},
        ]
    finally:
        settings.repo_root = original_repo_root
        settings.export_root = original_export_root
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole_with_curves(db: Session) -> Borehole:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="BH-CURVE-01",
        title="BH-CURVE-01",
        total_depth=100,
        source_workbook="uat.xlsx",
        workflow_status="ready_for_central_review",
        site=site,
    )
    borehole.curves = [
        Curve(
            key="ngamma",
            label="Natural Gamma",
            unit="API",
            source_type="las",
            color="#aa6633",
            samples=[
                CurveSample(depth=0.0, value=38.0),
                CurveSample(depth=1.0, value=42.0),
                CurveSample(depth=2.0, value=48.0),
            ],
        ),
        Curve(
            key="res",
            label="Resistivity",
            unit="ohm-m",
            source_type="las",
            color="#3366aa",
            samples=[
                CurveSample(depth=1.0, value=12.0),
                CurveSample(depth=2.0, value=18.0),
            ],
        ),
    ]
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
