from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Borehole, Curve, CurveSample, Project, Site
from app.db.session import Base
from app.domains.boreholes.service import curve_sample_window


def test_curve_sample_window_returns_visible_samples_with_boundaries() -> None:
    db = _test_session()
    try:
        borehole, _curve = _seed_curve_samples(db)

        window = curve_sample_window(db, borehole.id, "gamma", 12.0, 28.0)

        assert window.borehole_id == borehole.id
        assert window.key == "gamma"
        assert window.from_depth == 12.0
        assert window.to_depth == 28.0
        assert window.full_sample_count == 5
        assert window.window_sample_count == 1
        assert window.returned_sample_count == 3
        assert window.display_mode == "window_full"
        assert [(sample.depth, sample.value) for sample in window.samples] == [
            (10.0, 42.0),
            (20.0, 52.0),
            (30.0, 61.0),
        ]
    finally:
        db.close()


def test_curve_sample_window_normalizes_reversed_depth_range() -> None:
    db = _test_session()
    try:
        borehole, _curve = _seed_curve_samples(db)

        window = curve_sample_window(db, borehole.id, "gamma", 28.0, 12.0)

        assert window.from_depth == 12.0
        assert window.to_depth == 28.0
        assert [sample.depth for sample in window.samples] == [10.0, 20.0, 30.0]
    finally:
        db.close()


def test_curve_sample_window_decimates_without_losing_edges() -> None:
    db = _test_session()
    try:
        borehole, _curve = _seed_curve_samples(db)

        window = curve_sample_window(db, borehole.id, "gamma", 0.0, 40.0, max_samples=3)

        assert window.display_mode == "window_decimated"
        assert window.returned_sample_count == 3
        assert window.samples[0].depth == 0.0
        assert window.samples[-1].depth == 40.0
    finally:
        db.close()


def test_curve_sample_window_rejects_unknown_curve() -> None:
    db = _test_session()
    try:
        borehole, _curve = _seed_curve_samples(db)

        try:
            curve_sample_window(db, borehole.id, "density", 0.0, 10.0)
        except ValueError as exc:
            assert str(exc) == "Curve not found"
        else:
            raise AssertionError("Expected unknown curve to fail")
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_curve_samples(db: Session) -> tuple[Borehole, Curve]:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="BH-CURVE-01",
        title="BH-CURVE-01",
        total_depth=100,
        workflow_status="ready_for_central_review",
        site=site,
    )
    curve = Curve(
        borehole=borehole,
        key="gamma",
        label="Gamma",
        unit="API",
        source_type="las",
        color="#d97706",
    )
    db.add(project)
    db.add(curve)
    db.flush()
    db.add_all(
        CurveSample(curve=curve, depth=depth, value=value)
        for depth, value in [
            (0.0, 35.0),
            (10.0, 42.0),
            (20.0, 52.0),
            (30.0, 61.0),
            (40.0, 58.0),
        ]
    )
    db.commit()
    db.refresh(borehole)
    db.refresh(curve)
    return borehole, curve
