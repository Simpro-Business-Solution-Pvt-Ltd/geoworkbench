"""Idempotent replay and capture metadata for mobile field submissions.

Covers the offline-outbox contract: a field device resends the same outbox
item after an interrupted upload or a lost response; the server must return
the original submission without duplicating intervals or seam records.
Device capture time/timezone and the server receipt time are preserved.
"""

from datetime import datetime, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, get_db
from app.domains.auth.router import router as auth_router
from app.domains.boreholes.router import router as boreholes_router
from app.domains.mobile.router import router as mobile_router


@pytest.fixture()
def client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)

    def database():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(auth_router, prefix="/api/auth")
    app.include_router(mobile_router, prefix="/api/mobile")
    app.include_router(boreholes_router, prefix="/api/boreholes")
    app.dependency_overrides[get_db] = database
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    engine.dispose()


def _login(client, username="field", password="field123"):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _borehole(client, headers, code="GW3-01"):
    response = client.post(
        "/api/mobile/boreholes",
        headers=headers,
        json={
            "project_code": "GW3-TEST",
            "site_code": "MGCA",
            "borehole_code": code,
            "total_depth": 10,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["borehole"]["id"]


def _payload(borehole_id, from_depth=4.0, to_depth=4.5, **extra):
    body = {
        "borehole_id": borehole_id,
        "current_depth": to_depth,
        "apply_to_log": True,
        "lithology_intervals": [
            {"from_depth": from_depth, "to_depth": to_depth, "lithology_code": "COAL"}
        ],
    }
    body.update(extra)
    return body


def _interval_count(client, headers, borehole_id):
    workbench = client.get(f"/api/boreholes/{borehole_id}/workbench", headers=headers)
    assert workbench.status_code == 200, workbench.text
    return len(workbench.json()["lithology_intervals"])


def test_replay_same_client_submission_id_creates_no_duplicate(client):
    headers = _login(client)
    borehole_id = _borehole(client, headers)
    body = _payload(borehole_id, client_submission_id="gw3-item-0001")
    first = client.post("/api/mobile/field-submissions", headers=headers, json=body)
    assert first.status_code == 200, first.text
    first_body = first.json()
    assert first_body["field_submission_id"]
    assert first_body["server_received_at"]
    assert "Replay" not in first_body["message"]
    assert _interval_count(client, headers, borehole_id) == 1

    # The device never saw the first response (connection dropped) and resends
    # the same outbox item.
    replay = client.post("/api/mobile/field-submissions", headers=headers, json=body)
    assert replay.status_code == 200, replay.text
    replay_body = replay.json()
    assert replay_body["field_submission_id"] == first_body["field_submission_id"]
    assert "Replay ignored" in replay_body["message"]
    assert _interval_count(client, headers, borehole_id) == 1


def test_replay_after_interrupted_upload_keeps_single_seam(client):
    headers = _login(client)
    borehole_id = _borehole(client, headers)
    body = _payload(
        borehole_id,
        client_submission_id="gw3-item-0002",
        lithology_intervals=[
            {"from_depth": 5.0, "to_depth": 5.6, "lithology_code": "COAL", "seam_name": "S3"}
        ],
    )
    first = client.post("/api/mobile/field-submissions", headers=headers, json=body)
    assert first.status_code == 200, first.text
    replay = client.post("/api/mobile/field-submissions", headers=headers, json=body)
    assert replay.status_code == 200, replay.text
    assert replay.json()["field_submission_id"] == first.json()["field_submission_id"]

    workbench = client.get(f"/api/boreholes/{borehole_id}/workbench", headers=headers)
    assert workbench.status_code == 200, workbench.text
    data = workbench.json()
    assert len(data["lithology_intervals"]) == 1
    assert len(data["seam_intervals"]) == 1


def test_submission_without_client_id_keeps_legacy_append_behavior(client):
    headers = _login(client)
    borehole_id = _borehole(client, headers)
    first = client.post(
        "/api/mobile/field-submissions", headers=headers, json=_payload(borehole_id, 1.0, 1.5)
    )
    assert first.status_code == 200, first.text
    second = client.post(
        "/api/mobile/field-submissions", headers=headers, json=_payload(borehole_id, 2.0, 2.5)
    )
    assert second.status_code == 200, second.text
    assert second.json()["field_submission_id"] != first.json()["field_submission_id"]
    assert _interval_count(client, headers, borehole_id) == 2


def test_device_capture_and_server_receipt_are_preserved(client):
    headers = _login(client)
    borehole_id = _borehole(client, headers)
    body = _payload(
        borehole_id,
        client_submission_id="gw3-item-0003",
        device_captured_at="2026-11-25T09:30:00+05:30",
        device_timezone="Asia/Kolkata",
    )
    response = client.post("/api/mobile/field-submissions", headers=headers, json=body)
    assert response.status_code == 200, response.text
    body_out = response.json()
    # The response echoes the device capture time as the exact captured string,
    # offset included, from the stored payload — not the database-normalized
    # instant — so "09:30 IST" stays readable on any machine on every backend
    # database (the timestamptz column normalizes to UTC on Postgres).
    assert body_out["device_captured_at"] == "2026-11-25T09:30:00+05:30"
    assert body_out["device_timezone"] == "Asia/Kolkata"
    # Server receipt time is recorded on the submission. The offset is present on
    # Postgres (timestamptz); the SQLite test database returns it naive.
    assert body_out["server_received_at"]
    received = datetime.fromisoformat(body_out["server_received_at"])
    assert (datetime.now(timezone.utc).replace(tzinfo=None) - received.replace(tzinfo=None)).total_seconds() < 300

    workbench = client.get(f"/api/boreholes/{borehole_id}/workbench", headers=headers)
    assert workbench.status_code == 200, workbench.text
    submissions = workbench.json()["field_submissions"]
    stored = next(item for item in submissions if item["payload"].get("client_submission_id") == "gw3-item-0003")
    # The stored payload JSON is the authoritative device record and keeps the
    # exact captured string, offset included, on every database.
    assert stored["payload"]["device_captured_at"] == "2026-11-25T09:30:00+05:30"
    assert stored["payload"]["device_timezone"] == "Asia/Kolkata"
    # Replay echoes the same device metadata, so "captured X, received Y"
    # stays consistent on the device.
    replay = client.post("/api/mobile/field-submissions", headers=headers, json=body)
    assert replay.status_code == 200, replay.text
    assert replay.json()["device_timezone"] == "Asia/Kolkata"
    # The replay returns the same literal captured string, so the device record
    # is byte-stable across an interrupted/replayed sync.
    assert replay.json()["device_captured_at"] == "2026-11-25T09:30:00+05:30"


def test_overlapping_interval_reports_validation_issue_count(client):
    headers = _login(client)
    borehole_id = _borehole(client, headers)
    first = client.post(
        "/api/mobile/field-submissions",
        headers=headers,
        json=_payload(borehole_id, 0.0, 2.0, client_submission_id="gw3-item-0004"),
    )
    assert first.status_code == 200, first.text
    assert first.json()["validation_issue_count"] >= 0

    conflict = client.post(
        "/api/mobile/field-submissions",
        headers=headers,
        json=_payload(borehole_id, 1.0, 3.0, client_submission_id="gw3-item-0005"),
    )
    assert conflict.status_code == 200, conflict.text
    body = conflict.json()
    assert body["validation_issue_count"] >= 1
    workbench = client.get(f"/api/boreholes/{borehole_id}/workbench", headers=headers)
    assert workbench.status_code == 200, workbench.text
    codes = {
        issue["code"]
        for issue in workbench.json().get("validation_issues", [])
    }
    assert "interval_overlap" in codes


def test_borehole_create_replay_returns_existing_without_new_draft(client):
    headers = _login(client)
    first = client.post(
        "/api/mobile/boreholes",
        headers=headers,
        json={"project_code": "GW3-TEST", "site_code": "MGCA", "borehole_code": "GW3-09", "total_depth": 10},
    )
    assert first.status_code == 200, first.text
    assert first.json()["field_submission_id"]
    replay = client.post(
        "/api/mobile/boreholes",
        headers=headers,
        json={"project_code": "GW3-TEST", "site_code": "MGCA", "borehole_code": "GW3-09", "total_depth": 10},
    )
    assert replay.status_code == 200, replay.text
    body = replay.json()
    assert body["field_submission_id"] is None
    assert "already exists" in body["message"]
    assert body["borehole"]["code"] == "GW3-09"
