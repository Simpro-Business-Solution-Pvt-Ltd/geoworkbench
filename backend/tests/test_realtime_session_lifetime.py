import asyncio
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.realtime import RealtimeBroker, RealtimeEvent, RealtimeSubscription
from app.db import session as db_session
from app.db.models import AuthSession, User
from app.db.session import Base
from app.domains.realtime import router as realtime_routes


@pytest.fixture
def stream_app(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'sessions.db'}",
        connect_args={"check_same_thread": False},
        poolclass=QueuePool,
        pool_size=1,
        max_overflow=0,
        pool_timeout=0.1,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    with sessions() as db:
        user = User(username="stream-user", display_name="Stream user", role="site_geologist")
        db.add(user)
        db.flush()
        db.add(AuthSession(
            user_id=user.id,
            token="stream-token",
            client_type="web",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        ))
        db.commit()
    monkeypatch.setattr(db_session, "SessionLocal", sessions)
    monkeypatch.setattr(realtime_routes, "SessionLocal", sessions, raising=False)
    broker = RealtimeBroker()
    monkeypatch.setattr(realtime_routes, "realtime_broker", broker)
    next_event = RealtimeSubscription.next_event
    monkeypatch.setattr(
        RealtimeSubscription, "next_event",
        lambda self, timeout=30: next_event(self, min(timeout, 0.01)),
    )
    app = FastAPI()
    app.include_router(realtime_routes.router, prefix="/api/realtime")
    yield app, engine, sessions, broker
    engine.dispose()


def _request(app, token):
    messages = asyncio.Queue()
    disconnected = asyncio.Event()

    async def receive():
        await disconnected.wait()
        return {"type": "http.disconnect"}

    async def send(message):
        await messages.put(message)

    scope = {
        "type": "http", "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1", "method": "GET", "scheme": "http",
        "path": "/api/realtime/boreholes/1/events", "root_path": "",
        "query_string": f"token={token}".encode(), "headers": [],
        "server": ("test", 80), "client": ("127.0.0.1", 12345),
    }
    task = asyncio.create_task(app(scope, receive, send))
    return task, messages, disconnected


async def _next(messages):
    return await asyncio.wait_for(messages.get(), timeout=3)


def test_many_open_event_streams_leave_database_connection_available(stream_app):
    app, engine, sessions, broker = stream_app

    async def run():
        streams = []
        try:
            # More open clients than the server's original 5+10 connection budget.
            for _ in range(20):
                task, messages, disconnected = _request(app, "stream-token")
                streams.append((task, messages, disconnected))
                assert (await _next(messages))["status"] == 200
                assert b"event: connected" in (await _next(messages))["body"]
                assert engine.pool.checkedout() == 0
                with sessions() as db:
                    assert db.scalar(text("select 1")) == 1
            assert broker.subscriber_count() == 20
            broker.publish(RealtimeEvent(type="workbench.interval.updated", borehole_id=1))
            for _, messages, _ in streams:
                for _ in range(50):
                    if b"workbench.interval.updated" in (await _next(messages))["body"]:
                        break
                else:
                    pytest.fail("Open stream did not receive the published update")
        finally:
            for _, _, disconnected in streams:
                disconnected.set()
            await asyncio.wait_for(asyncio.gather(*(task for task, _, _ in streams)), timeout=3)
        assert broker.subscriber_count() == 0
        assert engine.pool.checkedout() == 0

    asyncio.run(run())


def test_invalid_event_stream_token_does_not_subscribe_or_hold_connection(stream_app):
    app, engine, _, broker = stream_app

    async def run():
        task, messages, _ = _request(app, "invalid")
        assert (await _next(messages))["status"] == 401
        await asyncio.wait_for(task, timeout=3)
        assert broker.subscriber_count() == 0
        assert engine.pool.checkedout() == 0

    asyncio.run(run())
