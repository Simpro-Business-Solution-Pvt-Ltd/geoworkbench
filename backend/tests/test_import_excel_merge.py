from pathlib import Path

from openpyxl import Workbook
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db.models import Borehole, LithologyInterval, Project, SeamInterval, Site, SourceFile, SourceImport
from app.db.session import Base
from app.domains.imports.service import merge_source_file_into_borehole


def test_excel_source_file_merges_known_template_intervals(tmp_path: Path) -> None:
    db = _test_session()
    settings = get_settings()
    original_repo_root = settings.repo_root
    settings.repo_root = tmp_path
    try:
        workbook_path = tmp_path / "incoming" / "CTSJ-IMPORT-01.xlsx"
        workbook_path.parent.mkdir(parents=True)
        _write_ctsj_workbook(workbook_path)
        borehole = _seed_borehole(db)
        source_file = SourceFile(
            borehole_id=borehole.id,
            file_type="excel",
            original_name=workbook_path.name,
            storage_path=str(workbook_path.relative_to(tmp_path)),
            status="uploaded",
            file_metadata={"storage_mode": "local"},
        )
        db.add(source_file)
        db.commit()
        db.refresh(source_file)

        updated_file, borehole_id, status, summary = merge_source_file_into_borehole(
            db,
            source_file.id,
            merge_options={"interval_mode": "append_new_depths"},
        )

        assert borehole_id == borehole.id
        assert status == "merged"
        assert updated_file.status == "merged"
        assert summary["merge_mode"] == "known_excel_template_first_log"
        assert summary["template"] == "ctsj_descriptive_v1"
        assert summary["lithology_intervals"] == 2
        assert summary["seam_intervals"] == 1
        assert summary["skipped_intervals"] == 0

        intervals = list(
            db.scalars(
                select(LithologyInterval)
                .where(LithologyInterval.borehole_id == borehole.id)
                .order_by(LithologyInterval.from_depth)
            )
        )
        assert [(item.from_depth, item.to_depth, item.lithology_code) for item in intervals] == [
            (0.0, 1.0, "SOIL"),
            (1.0, 2.0, "SHALE"),
            (2.0, 3.0, "COAL"),
        ]
        assert intervals[-1].rqd == 0.72
        assert intervals[-1].attributes["grain_size"] == "Fine"
        assert db.scalar(select(SeamInterval).where(SeamInterval.borehole_id == borehole.id)).name == "S1"
        assert (
            db.scalar(select(SourceImport).where(SourceImport.borehole_id == borehole.id)).status
            == "merged"
        )
    finally:
        settings.repo_root = original_repo_root
        db.close()


def _write_ctsj_workbook(path: Path) -> None:
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Lithology"
    worksheet["B3"] = "CTSJ-IMPORT-01"
    worksheet["B4"] = "BLOCK-A"
    worksheet["A7"] = "DRILLING RUN"
    worksheet["F7"] = "DEPTH & THICKNESS AFTER ADJUSTMENT"
    worksheet["I7"] = "Description as per core recovery"
    worksheet.append([])
    worksheet.append(
        [
            1.0,
            2.0,
            1.0,
            0.9,
            90,
            1.0,
            1.0,
            0.85,
            "SH",
            "Fine",
            "Grey",
            "12,18,22",
            65,
            "Few joints",
            "10",
            None,
            "Imported shale interval",
        ]
    )
    worksheet.append(
        [
            2.0,
            3.0,
            1.0,
            0.95,
            95,
            2.0,
            1.0,
            0.92,
            "COAL",
            "Fine",
            "Black",
            "20,28,24",
            72,
            "Bright bands",
            "8",
            "S1",
            "Imported coal seam",
        ]
    )
    workbook.save(path)


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole(db: Session) -> Borehole:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="CTSJ-IMPORT-01",
        title="CTSJ-IMPORT-01",
        total_depth=3.0,
        workflow_status="created",
        site=site,
        lithology_intervals=[
            LithologyInterval(
                id="ctsj-import-01-existing-1",
                from_depth=0.0,
                to_depth=1.0,
                lithology_code="SOIL",
                lithology_label="Soil",
                display_color="#b8a36a",
            )
        ],
    )
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
