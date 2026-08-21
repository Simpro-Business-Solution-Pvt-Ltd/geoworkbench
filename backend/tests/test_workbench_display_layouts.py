from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Borehole, DisplayLayout, Project, Site
from app.db.session import Base
from app.domains.boreholes.service import get_workbench


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
    db.add(project)
    db.add_all([first_layout, second_layout])
    db.commit()
    db.refresh(borehole)
    db.refresh(first_layout)
    db.refresh(second_layout)
    return borehole, first_layout, second_layout
