import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from pydantic import ValidationError

from app.db.models import Borehole, CorrectionAudit, LithologyInterval, Project, Site
from app.db.session import Base
from app.domains.boreholes.schemas import LithologyIntervalPatch
from app.domains.boreholes.service import update_lithology_interval


def test_manual_lithology_edit_marks_interval_as_geologist_corrected() -> None:
    db = _test_session()
    try:
        interval = _seed_interval(db)

        updated = update_lithology_interval(
            db,
            interval.id,
            LithologyIntervalPatch(
                change_reason="Corrected after central review",
                remark="Corrected after central review",
            ),
            actor="Central Geologist",
        )

        assert updated.remark == "Corrected after central review"
        assert updated.attributes["data_stage"] == "geologist_corrected"
        assert updated.attributes["stage_source_type"] == "manual_edit"
        assert updated.attributes["stage_actor"] == "Central Geologist"

        audit = db.scalar(select(CorrectionAudit).where(CorrectionAudit.interval_id == interval.id))
        assert audit is not None
        assert audit.changed_by == "Central Geologist"
        assert audit.change_reason == "Corrected after central review"
        assert audit.before_values["remark"] == "Original site note"
        assert audit.before_values["attributes"]["data_stage"] == "raw_imported"
        assert audit.after_values["remark"] == "Corrected after central review"
        assert audit.after_values["attributes"]["data_stage"] == "geologist_corrected"
    finally:
        db.close()


def test_manual_edit_without_reason_raises_validation_error() -> None:
    with pytest.raises(ValidationError) as exc_info:
        LithologyIntervalPatch(remark="Some correction")  # type: ignore[call-arg]
    assert "change_reason" in str(exc_info.value)


def test_manual_edit_with_empty_reason_raises_validation_error() -> None:
    with pytest.raises(ValidationError) as exc_info:
        LithologyIntervalPatch(change_reason="   ", remark="Some correction")
    assert "change_reason" in str(exc_info.value)


def test_manual_edit_stores_evidence_reference_in_audit() -> None:
    db = _test_session()
    try:
        interval = _seed_interval(db)

        update_lithology_interval(
            db,
            interval.id,
            LithologyIntervalPatch(
                change_reason="Verified against core photo",
                remark="Updated after photo review",
                evidence_core_photo_id="core-pbh62-box3",
                evidence_curve_key="GAMMA",
                evidence_depth=12.5,
            ),
            actor="Central Geologist",
        )

        audit = db.scalar(select(CorrectionAudit).where(CorrectionAudit.interval_id == interval.id))
        assert audit is not None
        assert audit.evidence_reference == {
            "core_photo_id": "core-pbh62-box3",
            "curve_key": "GAMMA",
            "depth": 12.5,
        }
    finally:
        db.close()


def test_manual_edit_without_evidence_stores_null() -> None:
    db = _test_session()
    try:
        interval = _seed_interval(db)

        update_lithology_interval(
            db,
            interval.id,
            LithologyIntervalPatch(
                change_reason="Geological judgment",
                remark="Updated per geologist judgment",
            ),
            actor="Central Geologist",
        )

        audit = db.scalar(select(CorrectionAudit).where(CorrectionAudit.interval_id == interval.id))
        assert audit is not None
        assert audit.evidence_reference is None
    finally:
        db.close()


def test_manual_edit_does_not_mutate_raw_imported_before_values() -> None:
    db = _test_session()
    try:
        interval = _seed_interval(db)

        update_lithology_interval(
            db,
            interval.id,
            LithologyIntervalPatch(
                change_reason="Corrected depth range",
                to_depth=1.5,
            ),
            actor="Central Geologist",
        )

        audit = db.scalar(select(CorrectionAudit).where(CorrectionAudit.interval_id == interval.id))
        assert audit is not None
        assert audit.before_values["attributes"]["data_stage"] == "raw_imported"
        assert audit.before_values["to_depth"] == 1.0
        assert audit.after_values["to_depth"] == 1.5
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_interval(db: Session) -> LithologyInterval:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="BH-CORR-01",
        title="BH-CORR-01",
        total_depth=10,
        workflow_status="created",
        site=site,
    )
    interval = LithologyInterval(
        id="bh-corr-01-lith-1",
        from_depth=0.0,
        to_depth=1.0,
        lithology_code="SH",
        lithology_label="Shale",
        display_color="#6b7280",
        remark="Original site note",
        attributes={"data_stage": "raw_imported"},
    )
    borehole.lithology_intervals.append(interval)
    db.add(project)
    db.commit()
    db.refresh(interval)
    return interval
