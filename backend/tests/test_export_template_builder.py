import csv
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

import app.domains.exports.service as export_service
from app.core.config import get_settings
from app.db.models import Borehole, ExportProfile, LithologyInterval, Project, Site
from app.db.session import Base
from app.domains.exports.service import (
    ExportProfileNotFound,
    ExportProfileReadOnly,
    create_export_profile,
    default_export_profiles,
    export_corrected_lithology_csv,
    export_source_fields,
    update_export_profile,
    validate_export_mapping,
)


def test_export_source_fields_cover_interval_writer_keys() -> None:
    db = _test_session()
    try:
        borehole = _seed_borehole(db)
        interval = borehole.lithology_intervals[0]
        known = {field["key"] for field in export_source_fields()}

        assert len(known) == len(export_source_fields())
        for key in _writer_keys():
            assert key in known
            assert export_service._interval_value(borehole, interval, key) is not None
    finally:
        db.close()


def _writer_keys() -> tuple[str, ...]:
    return (
        "borehole.code",
        "borehole.title",
        "lithology.source_row",
        "lithology.from_depth",
        "lithology.to_depth",
        "lithology.thickness",
        "lithology.lithology_code",
        "lithology.lithology_label",
        "lithology.logged_color",
        "lithology.seam_name",
        "lithology.recovery",
        "lithology.recovery_percent",
        "lithology.rqd_percent",
        "lithology.structural_features",
        "lithology.remark",
    )


def test_create_export_profile_normalizes_columns_and_sets_version() -> None:
    db = _test_session()
    try:
        profile = create_export_profile(
            db,
            export_type="corrected_lithology_csv",
            name="Minex interchange",
            description="Custom Minex layout",
            mapping={
                "columns": [
                    {"source": "borehole.code", "target": "BH"},
                    {"source": "lithology.from_depth", "target": "FROM"},
                    {"source": "lithology.attributes.weathering", "target": "WEATHERING"},
                ]
            },
        )

        assert profile.mapping["version"] == 1
        assert profile.mapping["columns"] == [
            {"source": "borehole.code", "target": "BH"},
            {"source": "lithology.from_depth", "target": "FROM"},
            {"source": "lithology.attributes.weathering", "target": "WEATHERING"},
        ]
        assert profile.export_type == "corrected_lithology_csv"
    finally:
        db.close()


def test_create_export_profile_rejects_duplicate_and_builtin_names() -> None:
    db = _test_session()
    try:
        create_export_profile(
            db,
            export_type="corrected_lithology_csv",
            name="Minex interchange",
            description=None,
            mapping={"columns": [{"source": "borehole.code", "target": "BH"}]},
        )

        _expect_error(
            create_export_profile,
            db,
            export_type="corrected_lithology_csv",
            name="Minex interchange",
            description=None,
            mapping={"columns": [{"source": "borehole.code", "target": "BH"}]},
        )
        _expect_error(
            create_export_profile,
            db,
            export_type="corrected_lithology_csv",
            name="Corrected Lithology CSV",
            description=None,
            mapping={"columns": [{"source": "borehole.code", "target": "BH"}]},
        )
    finally:
        db.close()


def test_create_export_profile_rejects_unsupported_type_and_bad_columns() -> None:
    db = _test_session()
    try:
        _expect_error(
            create_export_profile,
            db,
            export_type="minex_demo",
            name="Minex",
            description=None,
            mapping={"columns": [{"source": "borehole.code", "target": "BH"}]},
        )
        _expect_error(
            create_export_profile,
            db,
            export_type="corrected_lithology_csv",
            name="Bad source",
            description=None,
            mapping={"columns": [{"source": "lithology.nonexistent", "target": "X"}]},
        )
        _expect_error(
            create_export_profile,
            db,
            export_type="corrected_lithology_csv",
            name="Bad targets",
            description=None,
            mapping={
                "columns": [
                    {"source": "borehole.code", "target": "BH"},
                    {"source": "lithology.from_depth", "target": "BH"},
                ]
            },
        )
        _expect_error(
            create_export_profile,
            db,
            export_type="corrected_lithology_csv",
            name="  ",
            description=None,
            mapping={"columns": [{"source": "borehole.code", "target": "BH"}]},
        )
    finally:
        db.close()


def test_validate_export_mapping_preserves_advanced_keys_and_curve_selection() -> None:
    template = validate_export_mapping(
        "curves_las",
        {
            "depth": "DEPT.M",
            "curve_section": "~Curve Information",
            "sample_section": "~ASCII",
            "curve_dictionary": {"gamma": ["GR"]},
            "curves": ["gamma", "resistivity"],
        },
    )

    assert template["curve_dictionary"] == {"gamma": ["GR"]}
    assert template["curves"] == ["gamma", "resistivity"]
    assert template["depth"] == "DEPT.M"

    legacy_columns = validate_export_mapping(
        "corrected_lithology_csv",
        {"columns": ["borehole.code", "lithology.from_depth"]},
    )
    assert legacy_columns["columns"] == [
        {"source": "borehole.code", "target": "borehole.code"},
        {"source": "lithology.from_depth", "target": "lithology.from_depth"},
    ]

    _expect_error(validate_export_mapping, "curves_csv", {"curves": ["gamma", 42]})


def test_update_export_profile_builtin_is_read_only() -> None:
    db = _test_session()
    try:
        for profile in default_export_profiles():
            db.add(profile)
        db.commit()

        builtin = db.scalar(select(ExportProfile).where(ExportProfile.name == "Curve LAS"))
        assert builtin is not None
        try:
            update_export_profile(db, builtin.id, mapping={**builtin.mapping, "curves": ["gamma"]})
            raise AssertionError("expected ExportProfileReadOnly")
        except ExportProfileReadOnly:
            pass
    finally:
        db.close()


def test_update_export_profile_bumps_version_and_preserves_advanced_keys() -> None:
    db = _test_session()
    try:
        profile = create_export_profile(
            db,
            export_type="curves_las",
            name="My LAS export",
            description=None,
            mapping={"curve_dictionary": {"gamma": ["GR"]}, "curves": ["gamma"]},
        )

        updated = update_export_profile(
            db,
            profile.id,
            mapping={**profile.mapping, "curves": ["gamma", "resistivity"]},
        )

        assert updated.mapping["version"] == 2
        assert updated.mapping["curve_dictionary"] == {"gamma": ["GR"]}
        assert updated.mapping["curves"] == ["gamma", "resistivity"]
    finally:
        db.close()


def test_update_export_profile_missing_raises_not_found() -> None:
    db = _test_session()
    try:
        try:
            update_export_profile(db, 999)
            raise AssertionError("expected ExportProfileNotFound")
        except ExportProfileNotFound:
            pass
    finally:
        db.close()


def test_custom_export_profile_drives_csv_column_order(tmp_path: Path) -> None:
    db = _test_session()
    settings = get_settings()
    original_repo_root = settings.repo_root
    original_export_root = settings.export_root
    settings.repo_root = tmp_path
    settings.export_root = tmp_path / "exports"
    try:
        borehole = _seed_borehole(db)
        profile = create_export_profile(
            db,
            export_type="corrected_lithology_csv",
            name="Minex interchange",
            description=None,
            mapping={
                "columns": [
                    {"source": "lithology.lithology_label", "target": "rock"},
                    {"source": "lithology.from_depth", "target": "top"},
                    {"source": "borehole.code", "target": "bh"},
                ]
            },
        )

        job = export_corrected_lithology_csv(db, borehole.id, profile=profile)

        output_path = tmp_path / job.file_path
        with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.DictReader(handle))

        assert list(rows[0].keys()) == ["rock", "top", "bh"]
        assert rows[0]["rock"] == "Coal"
        assert rows[0]["top"] == "10.0"
        assert rows[0]["bh"] == "MGCA-08"
    finally:
        settings.repo_root = original_repo_root
        settings.export_root = original_export_root
        db.close()


@pytest.fixture()
def export_api_client(tmp_path: Path):
    from app.db.session import get_db
    from app.domains.exports.router import router

    engine = create_engine(f"sqlite:///{tmp_path / 'exports.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def database():
        with sessions() as db:
            yield db

    app = FastAPI()
    app.include_router(router, prefix="/api/exports")
    app.dependency_overrides[get_db] = database
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    engine.dispose()


def test_export_profile_api_source_fields_and_create(export_api_client: TestClient) -> None:
    fields = export_api_client.get("/api/exports/profiles/source-fields")
    assert fields.status_code == 200, fields.text
    keys = {item["key"] for item in fields.json()}
    assert {"borehole.code", "lithology.from_depth", "lithology.to_depth", "lithology.lithology_code"} <= keys

    created = export_api_client.post(
        "/api/exports/profiles",
        json={
            "export_type": "corrected_lithology_csv",
            "name": "Minex interchange",
            "description": "Custom layout",
            "mapping": {"columns": [{"source": "borehole.code", "target": "BH"}]},
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["builtin"] is False
    assert body["mapping"]["version"] == 1

    profiles = export_api_client.get("/api/exports/profiles")
    assert profiles.status_code == 200, profiles.text
    by_name = {item["name"]: item for item in profiles.json()}
    assert by_name["Corrected Lithology CSV"]["builtin"] is True
    assert by_name["Minex interchange"]["builtin"] is False

    duplicate = export_api_client.post(
        "/api/exports/profiles",
        json={
            "export_type": "corrected_lithology_csv",
            "name": "Minex interchange",
            "mapping": {"columns": [{"source": "borehole.code", "target": "BH"}]},
        },
    )
    assert duplicate.status_code == 400, duplicate.text

    bad_source = export_api_client.post(
        "/api/exports/profiles",
        json={
            "export_type": "corrected_lithology_csv",
            "name": "Bad source",
            "mapping": {"columns": [{"source": "lithology.nonexistent", "target": "X"}]},
        },
    )
    assert bad_source.status_code == 400, bad_source.text


def test_export_profile_api_update_errors_and_version_bump(export_api_client: TestClient) -> None:
    profiles = export_api_client.get("/api/exports/profiles").json()
    builtin = next(item for item in profiles if item["builtin"])

    patched_builtin = export_api_client.patch(
        f"/api/exports/profiles/{builtin['id']}", json={"name": "Hacked"}
    )
    assert patched_builtin.status_code == 400, patched_builtin.text

    missing = export_api_client.patch("/api/exports/profiles/999", json={"name": "X"})
    assert missing.status_code == 404, missing.text

    created = export_api_client.post(
        "/api/exports/profiles",
        json={
            "export_type": "corrected_lithology_xlsx",
            "name": "Custom xlsx",
            "mapping": {"columns": [{"source": "borehole.code", "target": "Borehole"}]},
        },
    ).json()

    updated = export_api_client.patch(
        f"/api/exports/profiles/{created['id']}",
        json={
            "mapping": {
                "columns": [
                    {"source": "borehole.code", "target": "Borehole"},
                    {"source": "lithology.from_depth", "target": "From"},
                ]
            }
        },
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["mapping"]["version"] == 2
    assert updated.json()["builtin"] is False


def _expect_error(fn, *args, **kwargs) -> None:
    try:
        fn(*args, **kwargs)
    except ValueError:
        return
    raise AssertionError(f"expected ValueError from {fn.__name__}")


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole(db: Session) -> Borehole:
    project = Project(code="MGCA", name="MGCA Project")
    site = Site(code="MGCA-SITE", name="MGCA Site", project=project)
    borehole = Borehole(
        code="MGCA-08",
        title="MGCA-08",
        total_depth=100,
        source_workbook="Data_10BH.zip",
        workflow_status="ready_for_central_review",
        site=site,
    )
    borehole.lithology_intervals = [
        LithologyInterval(
            id="MGCA-08-001",
            source_row=2,
            from_depth=10.0,
            to_depth=12.0,
            lithology_code="COAL",
            lithology_label="Coal",
            logged_color="black",
            seam_name="A",
            recovery=2.0,
            recovery_percent=100.0,
            rqd=0.74,
            structural_features="clean",
            remark="dense",
        )
    ]
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
