import csv
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Borehole, ExportProfile, LithologyInterval, Project, Site
from app.db.session import Base
from app.domains.exports.service import export_corrected_lithology_csv


def test_corrected_lithology_csv_export_writes_profiled_interval_data(tmp_path: Path) -> None:
    db = _test_session()
    settings = get_settings()
    original_repo_root = settings.repo_root
    original_export_root = settings.export_root
    settings.repo_root = tmp_path
    settings.export_root = tmp_path / "exports"
    try:
        borehole = _seed_borehole(db)
        profile = ExportProfile(
            name="UAT CSV",
            export_type="corrected_lithology_csv",
            mapping={
                "columns": [
                    {"source": "borehole.code", "target": "borehole_code"},
                    {"source": "lithology.from_depth", "target": "from_depth"},
                    {"source": "lithology.to_depth", "target": "to_depth"},
                    {"source": "lithology.thickness", "target": "thickness"},
                    {"source": "lithology.lithology_label", "target": "lithology"},
                    {"source": "lithology.rqd_percent", "target": "rqd_percent"},
                    {"source": "lithology.attributes.weathering", "target": "weathering"},
                ]
            },
        )

        job = export_corrected_lithology_csv(
            db,
            borehole.id,
            profile=profile,
            export_settings={"from_depth": 9.0, "to_depth": 12.5},
        )

        output_path = tmp_path / job.file_path
        with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        assert job.status == "generated"
        assert job.summary["interval_count"] == 1
        assert job.summary["export_profile"] == "UAT CSV"
        assert rows == [
            {
                "borehole_code": "BH-UAT-01",
                "from_depth": "10.0",
                "to_depth": "12.0",
                "thickness": "2.0",
                "lithology": "Coal",
                "rqd_percent": "74.0",
                "weathering": "fresh",
            }
        ]
    finally:
        settings.repo_root = original_repo_root
        settings.export_root = original_export_root
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole(db: Session) -> Borehole:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="BH-UAT-01",
        title="BH-UAT-01",
        total_depth=100,
        source_workbook="uat.xlsx",
        workflow_status="ready_for_central_review",
        site=site,
    )
    borehole.lithology_intervals = [
        LithologyInterval(
            id="BH-UAT-01-001",
            source_row=1,
            from_depth=0.0,
            to_depth=5.0,
            lithology_code="OB",
            lithology_label="Overburden",
        ),
        LithologyInterval(
            id="BH-UAT-01-002",
            source_row=2,
            from_depth=10.0,
            to_depth=12.0,
            lithology_code="COAL",
            lithology_label="Coal",
            seam_name="A",
            rqd=0.74,
            attributes={"weathering": "fresh"},
        ),
    ]
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
