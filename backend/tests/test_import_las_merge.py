from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Borehole, Curve, CurveSample, Project, Site, SourceFile, SourceImport
from app.db.session import Base
from app.domains.imports.service import merge_source_file_into_borehole


def test_las_source_file_merges_curves_into_existing_borehole(tmp_path: Path) -> None:
    db = _test_session()
    settings = get_settings()
    original_repo_root = settings.repo_root
    settings.repo_root = tmp_path
    try:
        las_path = tmp_path / "incoming" / "BH-IMPORT-01.las"
        las_path.parent.mkdir(parents=True)
        las_path.write_text(
            "\n".join(
                [
                    "~Version Information",
                    "VERS. 2.0 : CWLS LAS version",
                    "WRAP. NO : One line per depth step",
                    "~Well Information",
                    "WELL. BH-IMPORT-01 : Borehole code",
                    "NULL. -999.25 : Null value",
                    "~Curve Information",
                    "DEPT.M : Depth",
                    "NGAMMA.API : Natural Gamma",
                    "RES.ohm-m : Resistivity",
                    "~ASCII",
                    "0.00 38.0 10.0",
                    "1.00 42.0 -999.25",
                    "2.00 48.0 18.0",
                ]
            ),
            encoding="utf-8",
        )
        borehole = _seed_borehole(db)
        source_file = SourceFile(
            borehole_id=borehole.id,
            file_type="las",
            original_name=las_path.name,
            storage_path=str(las_path.relative_to(tmp_path)),
            status="uploaded",
            file_metadata={"storage_mode": "local"},
        )
        db.add(source_file)
        db.commit()
        db.refresh(source_file)

        updated_file, borehole_id, status, summary = merge_source_file_into_borehole(db, source_file.id)

        assert borehole_id == borehole.id
        assert status == "merged"
        assert updated_file.status == "merged"
        assert summary["merge_mode"] == "las_curves"
        assert summary["depth_range"] == {"from": 0.0, "to": 2.0}
        assert [(curve["key"], curve["samples"]) for curve in summary["curves"]] == [
            ("gamma", 3),
            ("resistivity", 2),
        ]

        curves = list(db.scalars(select(Curve).where(Curve.borehole_id == borehole.id).order_by(Curve.key)))
        assert [curve.key for curve in curves] == ["gamma", "resistivity"]
        sample_counts = {
            curve.key: len(
                list(db.scalars(select(CurveSample).where(CurveSample.curve_id == curve.id)))
            )
            for curve in curves
        }
        assert sample_counts == {"gamma": 3, "resistivity": 2}
        assert (
            db.scalar(select(SourceImport).where(SourceImport.borehole_id == borehole.id)).status
            == "merged"
        )
    finally:
        settings.repo_root = original_repo_root
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole(db: Session) -> Borehole:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="BH-IMPORT-01",
        title="BH-IMPORT-01",
        total_depth=100,
        workflow_status="created",
        site=site,
    )
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
