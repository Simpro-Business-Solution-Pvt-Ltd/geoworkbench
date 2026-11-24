from io import BytesIO

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from openpyxl import Workbook, load_workbook
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import get_settings
from app.db.session import Base, get_db
from app.domains.auth.router import router as auth_router
from app.domains.boreholes.router import router as boreholes_router
from app.domains.exports.router import router as exports_router
from app.domains.imports.router import router as imports_router
from app.domains.mobile.router import router as mobile_router


@pytest.fixture(params=["inside", "outside"])
def field_client(tmp_path, monkeypatch, request):
    repo = tmp_path / "release"
    repo.mkdir()
    runtime = repo / "runtime-data" if request.param == "inside" else tmp_path / "durable-data"
    settings = get_settings()
    monkeypatch.setattr(settings, "repo_root", repo)
    monkeypatch.setattr(settings, "upload_root", runtime / "uploads")
    monkeypatch.setattr(settings, "export_root", runtime / "exports")
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)

    def database():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(auth_router, prefix="/api/auth")
    app.include_router(mobile_router, prefix="/api/mobile")
    app.include_router(imports_router, prefix="/api/imports")
    app.include_router(boreholes_router, prefix="/api/boreholes")
    app.include_router(exports_router, prefix="/api/exports")
    app.dependency_overrides[get_db] = database
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, repo, runtime
    engine.dispose()


def _login(client, username, password):
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['token']}"}


def _borehole(client, headers):
    response = client.post("/api/mobile/boreholes", headers=headers, json={
        "project_code": "PWA-TEST", "project_name": "PWA test", "site_code": "SITE",
        "borehole_code": "PWA-01", "total_depth": 3, "current_depth": 0,
    })
    assert response.status_code == 200, response.text
    return response.json()["borehole"]["id"]


def _upload(client, headers, borehole_id, name, kind, content, mime):
    response = client.post("/api/mobile/uploads", headers=headers,
        data={"borehole_id": str(borehole_id), "file_type": kind},
        files={"file": (name, content, mime)})
    assert response.status_code == 200, response.text
    assert response.json()["borehole_id"] == borehole_id
    return response.json()["id"]


def _xlsx():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Intervals"
    sheet.append(["From", "To", "Rock", "RQD", "Recovery", "Seam"])
    sheet.append([1, 2, "COAL", 65, 90, "S1"])
    sheet.append([2, 3, "SHALE", 70, 95, None])
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


LAS = b"""~Version Information
VERS. 2.0 : LAS version
WRAP. NO : No wrapping
~Well Information
WELL. PWA-01 : Borehole
NULL. -999.25 : Null value
~Curve Information
DEPT.M : Depth
GR.API : Natural Gamma
RES.OHMM : Resistivity
~ASCII
0 85 30
1 20 90
2 35 70
3 95 25
"""


def test_field_create_capture_upload_merge_and_export(field_client):
    client, repo, runtime = field_client
    field_headers = _login(client, "field", "field123")
    borehole_id = _borehole(client, field_headers)
    capture = client.post("/api/mobile/field-submissions", headers=field_headers, json={
        "borehole_id": borehole_id, "current_depth": 1, "apply_to_log": True,
        "lithology_intervals": [{"from_depth": 0, "to_depth": 1, "lithology_code": "SANDSTONE"}],
        "runtime_parameters": [{"name": "Drilling rate", "value": "2.5", "unit": "m/h"}],
    })
    assert capture.status_code == 200, capture.text

    excel_id = _upload(client, field_headers, borehole_id, "intervals.xlsx", "excel", _xlsx(),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    las_id = _upload(client, field_headers, borehole_id, "curves.las", "las", LAS, "text/plain")
    # Other attachments are retained as source bytes, not automatically interpreted.
    _upload(client, field_headers, borehole_id, "site-photo.jpg", "images", b"photo-fixture", "image/jpeg")
    _upload(client, field_headers, borehole_id, "composite.pdf", "geophysical_pdf", b"%PDF-fixture", "application/pdf")
    files = client.get(f"/api/imports/source-files?borehole_id={borehole_id}").json()
    assert len(files) == 4
    for item in files:
        assert (repo / item["storage_path"]).is_file()
    assert len(list((runtime / "uploads" / f"borehole-{borehole_id}").iterdir())) == 4

    admin_headers = _login(client, "geologist", "geologist123")
    template = client.post("/api/imports/profiles", headers=admin_headers, json={
        "name": "Field workbook", "mapping": {
            "kind": "tabular_intervals", "detect": {"sheet": "Intervals"}, "header_row": 1,
            "borehole": {"source": "selected"}, "depth": {"from": "From", "to": "To"},
            "fields": {"lithology": "Rock", "rqd": "RQD", "recovery_percent": "Recovery", "seam_name": "Seam"},
        },
    })
    assert template.status_code == 200, template.text
    for source_id in [excel_id, las_id]:
        parsed = client.post(f"/api/imports/source-files/{source_id}/process", headers=admin_headers)
        assert parsed.status_code == 200, parsed.text
        assert parsed.json()["source_file"]["status"] == "parsed"
        merged = client.post(f"/api/imports/source-files/{source_id}/merge", headers=admin_headers,
            json={"interval_mode": "append_new_depths"})
        assert merged.status_code == 200, merged.text
        assert merged.json()["status"] == "merged"

    workbench = client.get(f"/api/boreholes/{borehole_id}/workbench", headers=admin_headers)
    assert workbench.status_code == 200, workbench.text
    assert len(workbench.json()["lithology_intervals"]) == 3
    assert len(workbench.json()["curves"]) == 2
    coal = next(row for row in workbench.json()["lithology_intervals"] if row["from_depth"] == 1)
    assert coal["rqd"] == 0.65
    assert coal["recovery_percent"] == 90

    for kind in ["corrected_lithology_xlsx", "curves_las"]:
        generated = client.post(f"/api/exports/boreholes/{borehole_id}/jobs", headers=admin_headers,
            json={"export_type": kind, "from_depth": 0, "to_depth": 3})
        assert generated.status_code == 200, generated.text
        job = generated.json()
        assert (repo / job["file_path"]).is_file()
        download = client.get(f"/api/exports/jobs/{job['id']}/download", headers=admin_headers)
        assert download.status_code == 200
        if kind == "curves_las":
            assert "~Curve Information" in download.text
        else:
            workbook = load_workbook(BytesIO(download.content), read_only=True)
            assert workbook.active.max_row == 4
            workbook.close()
