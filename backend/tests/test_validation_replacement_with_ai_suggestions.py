import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from app.db.models import AiSuggestion, ValidationIssue
from app.db.session import Base, get_db
from app.domains.ai.router import router as ai_router
from app.domains.auth.router import router as auth_router
from app.domains.boreholes.router import router as boreholes_router
from app.domains.mobile.router import router as mobile_router


@pytest.fixture()
def fk_client(tmp_path):
    engine = create_engine(
        f"sqlite:///{tmp_path / 'test.db'}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(engine, "connect")
    def _enforce_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def database():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(auth_router, prefix="/api/auth")
    app.include_router(mobile_router, prefix="/api/mobile")
    app.include_router(boreholes_router, prefix="/api/boreholes")
    app.include_router(ai_router, prefix="/api/ai")
    app.dependency_overrides[get_db] = database
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, sessions
    engine.dispose()


def _login(client, username, password):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _submit(client, headers, borehole_id, current_depth, from_depth, to_depth, code):
    return client.post("/api/mobile/field-submissions", headers=headers, json={
        "borehole_id": borehole_id,
        "current_depth": current_depth,
        "apply_to_log": True,
        "lithology_intervals": [{"from_depth": from_depth, "to_depth": to_depth, "lithology_code": code}],
    })


def test_field_submission_with_ai_suggestions_replaces_validation_issues(fk_client):
    client, sessions = fk_client
    headers = _login(client, "field", "field123")
    created = client.post("/api/mobile/boreholes", headers=headers, json={
        "project_code": "PWA-FK", "project_name": "PWA FK test", "site_code": "SITE",
        "borehole_code": "PWA-FK01", "total_depth": 100, "current_depth": 0,
    })
    assert created.status_code == 200, created.text
    borehole_id = created.json()["borehole"]["id"]

    first = _submit(client, headers, borehole_id, 1, 0, 1, "COAL")
    assert first.status_code == 200, first.text

    generated = client.post(f"/api/ai/boreholes/{borehole_id}/suggestions/generate")
    assert generated.status_code == 200, generated.text
    suggestions = generated.json()
    assert any(item.get("validation_issue_id") for item in suggestions), (
        "expected rule-based suggestions linked to validation issues"
    )

    with sessions() as db:
        old_issue_ids = {
            item.id
            for item in db.scalars(
                select(ValidationIssue).where(ValidationIssue.borehole_id == borehole_id)
            )
        }
    assert old_issue_ids

    second = _submit(client, headers, borehole_id, 2, 1, 2, "SHCOAL")
    assert second.status_code == 200, second.text

    with sessions() as db:
        surviving = list(
            db.scalars(select(AiSuggestion).where(AiSuggestion.borehole_id == borehole_id))
        )
        current_issue_ids = {
            item.id
            for item in db.scalars(
                select(ValidationIssue).where(ValidationIssue.borehole_id == borehole_id)
            )
        }
    assert len(surviving) == len(suggestions), "suggestions must survive the replacement"
    for suggestion in surviving:
        assert suggestion.validation_issue_id is None or suggestion.validation_issue_id in current_issue_ids
    assert not (old_issue_ids & current_issue_ids), "validation issues were replaced"

    approved = client.post(f"/api/boreholes/{borehole_id}/approve-export", headers=headers)
    assert approved.status_code == 200, approved.text
    assert "workflow_status" in approved.json()
