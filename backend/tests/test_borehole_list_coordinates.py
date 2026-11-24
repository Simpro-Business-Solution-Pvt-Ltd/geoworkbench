from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Borehole, Project, Site
from app.db.session import Base
from app.domains.boreholes.service import list_boreholes


def test_borehole_list_includes_compact_coordinates() -> None:
    db = _test_session()
    try:
        project = Project(code="RELIANCE", name="Reliance")
        site = Site(code="MGCA", name="MGCA", project=project)
        db.add(
            Borehole(
                code="MGCA-08",
                title="MGCA-08",
                total_depth=801,
                workflow_status="imported_with_las_merge",
                site=site,
                attributes={
                    "collar": {
                        "coalgrid_easting": 765202.258,
                        "coalgrid_northing": 3211156.289,
                        "utm_easting": 498162.19,
                        "utm_northing": 1893053.37,
                    }
                },
            )
        )
        db.commit()

        result = list_boreholes(db)

        assert result[0].coordinates == {
            "system": "utm",
            "x": 498162.19,
            "y": 1893053.37,
            "x_label": "utm_easting",
            "y_label": "utm_northing",
        }
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()
