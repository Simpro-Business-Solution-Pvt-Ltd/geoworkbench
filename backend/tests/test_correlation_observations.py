from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.session import Base
from app.domains.correlation.schemas import CorrelationObservationCreate
from app.domains.correlation.service import correlation_key, create_observation, list_observations


def test_correlation_key_is_stable_for_selected_borehole_set() -> None:
    assert correlation_key([7, 3, 7, 1]) == "1:3:7"


def test_correlation_observations_are_persisted_by_borehole_set() -> None:
    db = _test_session()
    try:
        first = create_observation(
            db,
            CorrelationObservationCreate(
                borehole_ids=[4, 2, 3],
                text="Seam II continuity needs review between BH-02 and BH-04.",
                observation_metadata={"source": "correlation_dialog"},
            ),
            created_by="central-geologist",
        )
        create_observation(
            db,
            CorrelationObservationCreate(borehole_ids=[9], text="Different correlation set."),
        )

        notes = list_observations(db, [3, 4, 2])

        assert len(notes) == 1
        assert notes[0].id == first.id
        assert notes[0].correlation_key == "2:3:4"
        assert notes[0].borehole_ids == [2, 3, 4]
        assert notes[0].created_by == "central-geologist"
        assert notes[0].observation_metadata == {"source": "correlation_dialog"}
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()
