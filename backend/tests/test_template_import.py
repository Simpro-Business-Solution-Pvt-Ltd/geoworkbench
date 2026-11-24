from pathlib import Path

import pytest
from openpyxl import Workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.models import Borehole, Project, Site, SourceFile
from app.db.session import Base
from app.domains.imports.service import (
    create_import_profile,
    merge_source_file_into_borehole,
    process_source_file,
    update_import_profile,
)
from app.services.template_import import read_template_dataset


def _mapping() -> dict:
    return {
        "kind": "tabular_intervals",
        "detect": {"sheet": "Intervals"},
        "header_row": 1,
        "borehole": {"source": "column", "column": "Hole", "normalize": "zero_pad_number:2"},
        "depth": {"from": "From", "to": "To"},
        "fields": {
            "lithology": "Rock",
            "recovery_percent": "Recovery %",
            "rqd": "RQD %",
            "seam_name": "Seam",
            "remark": ["Description", "Comment"],
        },
    }


@pytest.fixture
def workbook_path(tmp_path: Path) -> Path:
    path = tmp_path / "intervals.xlsx"
    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = "Intervals"
    worksheet.append(["Hole", "From", "To", "Rock", "Recovery %", "RQD %", "Seam", "Description", "Comment"])
    worksheet.append(["MGCA-8", 0, 1, "SH", 0, 0, None, "Grey", "Jointed"])
    worksheet.append(["MGCA-8", 1, 2, "COAL", 85, 65, "S1", "Black", "Bright"])
    worksheet.append(["MGCA-9", 10, 11, "COAL", 90, 75, "S2", "Black", None])
    workbook.save(path)
    workbook.close()
    return path


@pytest.fixture
def db(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(get_settings(), "repo_root", tmp_path)
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine, autoflush=False) as session:
        yield session
    engine.dispose()


def _source(db: Session, path: Path, code: str = "MGCA-08") -> SourceFile:
    site = Site(code="SITE", name="Site", project=Project(code="TEST", name="Test"))
    borehole = Borehole(code=code, title=code, total_depth=0, site=site)
    source = SourceFile(
        borehole=borehole,
        file_type="excel",
        original_name=path.name,
        storage_path=str(path),
        status="uploaded",
    )
    db.add(source)
    db.commit()
    return source


def test_template_reader_filters_boreholes_and_preserves_mapped_fields(workbook_path: Path):
    dataset = read_template_dataset(
        workbook_path, _mapping(), borehole_code="MGCA-08", template_label="Test v1"
    )

    intervals = dataset["lithologyIntervals"]
    assert len(intervals) == 2
    assert intervals[0]["recoveryPercent"] == 0
    assert intervals[1]["recoveryPercent"] == 85
    assert intervals[1]["rqd"] == 0.65
    assert intervals[1]["remark"] == "Black / Bright"
    assert dataset["seamIntervals"][0]["name"] == "S1"
    assert dataset["profile"]["summary"]["borehole_row_counts"] == {"MGCA-08": 2, "MGCA-09": 1}


def test_registry_merge_uses_preview_snapshot_and_supports_repeat_replacement(db: Session, workbook_path: Path):
    profile = create_import_profile(db, name="Test intervals", description=None, mapping=_mapping())
    source = _source(db, workbook_path)
    _, _, preview = process_source_file(db, source.id)
    assert source.status == "parsed"
    assert preview["registry_template"]["version"] == 1

    # A template edited after profiling must not alter the pending import.
    changed = _mapping()
    changed["fields"]["lithology"] = "New rock column"
    update_import_profile(db, profile.id, mapping=changed)

    for _ in range(2):
        _, borehole_id, status, summary = merge_source_file_into_borehole(
            db, source.id, {"interval_mode": "replace_overlapping_range"}
        )
        assert status == "merged"
        assert summary["lithology_intervals"] == 2
        borehole = db.get(Borehole, borehole_id)
        intervals = sorted(borehole.lithology_intervals, key=lambda item: item.from_depth)
        assert len(intervals) == 2
        assert [item.recovery_percent for item in intervals] == [0, 85]
        assert intervals[1].attributes["data_stage"] == "raw_imported"
        assert intervals[1].rqd == 0.65
        assert len(borehole.seam_intervals) == 1


def test_registry_merge_can_load_another_source_borehole_and_append(db: Session, workbook_path: Path):
    create_import_profile(db, name="Test intervals", description=None, mapping=_mapping())
    source = _source(db, workbook_path, code="NEW-01")
    process_source_file(db, source.id)
    with pytest.raises(ValueError, match="No rows for borehole"):
        merge_source_file_into_borehole(db, source.id)

    for source_code in ["MGCA-08", "MGCA-09"]:
        merge_source_file_into_borehole(
            db,
            source.id,
            {"interval_mode": "append_new_depths", "source_borehole_code": source_code},
        )
    borehole = db.get(Borehole, source.borehole_id)
    assert borehole.code == "NEW-01"
    assert borehole.total_depth == 11
    assert len(borehole.lithology_intervals) == 3
    assert {seam.name for seam in borehole.seam_intervals} == {"S1", "S2"}
