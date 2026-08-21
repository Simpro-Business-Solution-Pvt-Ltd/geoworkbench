from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Borehole, Curve, CurveSample, ExportProfile, Project, Site
from app.db.session import Base
from app.domains.exports.service import export_curves_las


def test_curves_las_export_writes_selected_curves_and_null_values(tmp_path: Path) -> None:
    db = _test_session()
    settings = get_settings()
    original_repo_root = settings.repo_root
    original_export_root = settings.export_root
    settings.repo_root = tmp_path
    settings.export_root = tmp_path / "exports"
    try:
        borehole = _seed_borehole_with_curves(db)
        profile = ExportProfile(
            name="Composite Curves",
            export_type="curves_las",
            mapping={"curves": ["ngamma", "res"]},
        )

        job = export_curves_las(
            db,
            borehole.id,
            profile=profile,
            export_settings={"from_depth": 1.0, "to_depth": 2.0},
        )

        output_path = tmp_path / job.file_path
        content = output_path.read_text(encoding="utf-8")

        assert job.status == "generated"
        assert job.summary["curve_count"] == 2
        assert job.summary["sample_depth_count"] == 2
        assert job.summary["requested_depth_range"] == {"from_depth": 1.0, "to_depth": 2.0}
        assert job.summary["data_stage_counts"]["curves"] == {"raw_imported": 2}
        assert job.summary["source_evidence"]["source_workbook"] == "uat.xlsx"
        assert "VERS.                  2.0 : CWLS LAS version" in content
        assert "WELL. BH-LAS-01 : Borehole code" in content
        assert "NGAMMA.API : Natural Gamma" in content
        assert "RES.ohm-m : Resistivity" in content
        assert "~ASCII\n1.00 42.0000 -999.25\n2.00 48.0000 18.0000\n" in content
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
        code="BH-LAS-01",
        title="BH-LAS-01",
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
            curve_metadata={"data_stage": "raw_imported"},
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
            curve_metadata={"data_stage": "raw_imported"},
            samples=[
                CurveSample(depth=2.0, value=18.0),
                CurveSample(depth=3.0, value=21.0),
            ],
        ),
    ]
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
