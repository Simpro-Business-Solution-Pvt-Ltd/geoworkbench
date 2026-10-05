from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import AuthSession, User
from app.db.session import Base
from app.domains.auth import service


def test_get_session_extends_active_session_near_expiry(monkeypatch) -> None:
    db = _test_session()
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: SimpleNamespace(auth_token_hours=24, auth_session_refresh_threshold_minutes=30),
    )
    try:
        user = User(username="active", display_name="Active User", role="site_geologist", is_active=1)
        db.add(user)
        db.flush()
        original_expiry = datetime.now(timezone.utc) + timedelta(minutes=5)
        session = AuthSession(
            user_id=user.id,
            token="active-token",
            client_type="web",
            expires_at=original_expiry,
        )
        db.add(session)
        db.commit()

        _, refreshed = service.get_session(db, "active-token")

        assert service._to_aware(refreshed.expires_at) > original_expiry + timedelta(hours=12)
    finally:
        db.close()


def test_get_session_keeps_far_future_expiry(monkeypatch) -> None:
    db = _test_session()
    monkeypatch.setattr(
        service,
        "get_settings",
        lambda: SimpleNamespace(auth_token_hours=24, auth_session_refresh_threshold_minutes=30),
    )
    try:
        user = User(username="fresh", display_name="Fresh User", role="site_geologist", is_active=1)
        db.add(user)
        db.flush()
        original_expiry = datetime.now(timezone.utc) + timedelta(hours=20)
        session = AuthSession(
            user_id=user.id,
            token="fresh-token",
            client_type="web",
            expires_at=original_expiry,
        )
        db.add(session)
        db.commit()

        _, current = service.get_session(db, "fresh-token")

        assert service._to_aware(current.expires_at) == original_expiry
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()
