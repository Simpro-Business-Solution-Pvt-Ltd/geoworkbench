from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Borehole, CorrectionAudit, DisplayLayout, LithologyInterval, Project, Site
from app.db.session import Base
from app.domains.boreholes.service import clone_display_layout, delete_display_layout, get_workbench


def test_workbench_returns_layout_options_and_uses_default_layout_when_not_selected() -> None:
    db = _test_session()
    try:
        borehole, first_layout, second_layout = _seed_borehole_with_layouts(db)

        workbench = get_workbench(db, borehole.id)

        assert workbench.layout is not None
        assert workbench.layout.id == first_layout.id
        assert [(layout.id, layout.name) for layout in workbench.display_layouts] == [
            (first_layout.id, "Default Review"),
            (second_layout.id, "Curve Focus"),
        ]
        assert len(workbench.correction_audits) == 1
        assert workbench.correction_audits[0].interval_id == "bh-layout-01-lith-1"
        assert workbench.correction_audits[0].after_values["remark"] == "Updated"
    finally:
        db.close()


def test_workbench_can_select_requested_display_layout() -> None:
    db = _test_session()
    try:
        borehole, _first_layout, second_layout = _seed_borehole_with_layouts(db)

        workbench = get_workbench(db, borehole.id, second_layout.id)

        assert workbench.layout is not None
        assert workbench.layout.id == second_layout.id
        assert workbench.layout.name == "Curve Focus"
    finally:
        db.close()


def test_display_layout_clone_copies_settings_for_same_borehole() -> None:
    db = _test_session()
    try:
        borehole, first_layout, _second_layout = _seed_borehole_with_layouts(db)

        clone = clone_display_layout(db, first_layout.id, "Stakeholder Review")

        assert clone.id != first_layout.id
        assert clone.borehole_id == borehole.id
        assert clone.name == "Stakeholder Review"
        assert clone.settings == first_layout.settings
        clone.settings["widgets"] = {"new-widget": {"type": "single-value", "title": "New"}}
        assert first_layout.settings["widgets"] == {}
    finally:
        db.close()


def test_display_layout_delete_returns_fallback_layout() -> None:
    db = _test_session()
    try:
        borehole, first_layout, second_layout = _seed_borehole_with_layouts(db)

        fallback = delete_display_layout(db, second_layout.id)
        workbench = get_workbench(db, borehole.id)

        assert fallback.id == first_layout.id
        assert [layout.id for layout in workbench.display_layouts] == [first_layout.id]
    finally:
        db.close()


def test_display_layout_delete_keeps_at_least_one_layout() -> None:
    db = _test_session()
    try:
        _borehole, first_layout, second_layout = _seed_borehole_with_layouts(db)

        delete_display_layout(db, second_layout.id)
        try:
            delete_display_layout(db, first_layout.id)
        except ValueError as exc:
            assert str(exc) == "At least one display layout must remain"
        else:
            raise AssertionError("Expected last display layout delete to fail")
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole_with_layouts(db: Session) -> tuple[Borehole, DisplayLayout, DisplayLayout]:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="BH-LAYOUT-01",
        title="BH-LAYOUT-01",
        total_depth=100,
        workflow_status="ready_for_central_review",
        site=site,
    )
    first_layout = DisplayLayout(
        borehole=borehole,
        name="Default Review",
        mode="runtime",
        settings={"schemaVersion": 2, "grid": {"columns": 24, "rowHeight": 12, "items": []}, "widgets": {}},
    )
    second_layout = DisplayLayout(
        borehole=borehole,
        name="Curve Focus",
        mode="runtime",
        settings={"schemaVersion": 2, "grid": {"columns": 24, "rowHeight": 12, "items": []}, "widgets": {}},
    )
    interval = LithologyInterval(
        borehole=borehole,
        id="bh-layout-01-lith-1",
        from_depth=0.0,
        to_depth=1.0,
        lithology_code="SH",
        lithology_label="Shale",
    )
    db.add(project)
    db.add_all([first_layout, second_layout, interval])
    db.flush()
    db.add(
        CorrectionAudit(
            borehole_id=borehole.id,
            interval_id=interval.id,
            before_values={"remark": "Original"},
            after_values={"remark": "Updated"},
        )
    )
    db.commit()
    db.refresh(borehole)
    db.refresh(first_layout)
    db.refresh(second_layout)
    return borehole, first_layout, second_layout
