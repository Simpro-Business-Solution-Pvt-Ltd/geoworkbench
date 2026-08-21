from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

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
            LithologyIntervalPatch(remark="Corrected after central review"),
            actor="Central Geologist",
        )

        assert updated.remark == "Corrected after central review"
        assert updated.attributes["data_stage"] == "geologist_corrected"
        assert updated.attributes["stage_source_type"] == "manual_edit"
        assert updated.attributes["stage_actor"] == "Central Geologist"

        audit = db.scalar(select(CorrectionAudit).where(CorrectionAudit.interval_id == interval.id))
        assert audit is not None
        assert audit.changed_by == "Central Geologist"
        assert audit.before_values["remark"] == "Original site note"
        assert audit.before_values["attributes"]["data_stage"] == "raw_imported"
        assert audit.after_values["remark"] == "Corrected after central review"
        assert audit.after_values["attributes"]["data_stage"] == "geologist_corrected"
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
