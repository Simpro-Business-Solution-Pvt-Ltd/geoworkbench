from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import (
    Borehole,
    Curve,
    CurveSample,
    LithologyInterval,
    Project,
    SeamInterval,
    Site,
    SourceFile,
    SourceImport,
    ValidationIssue,
)
from app.db.session import Base
from app.domains.ai import service as ai_service


def test_borehole_summary_includes_reliance_uat_evidence(monkeypatch) -> None:
    db = _test_session()
    monkeypatch.setattr(ai_service, "ai_provider_status", lambda: {"enabled": False, "reachable": False})
    try:
        borehole = _seed_borehole(db)

        result = ai_service.summarize_borehole(db, borehole.id)

        assert "about 1.50m combined thickness" in result["summary"]
        assert "S1" in result["summary"]
        assert "corebox image package not supplied" in result["summary"]
        assert "Review focus:" in result["summary"]
        assert result["metrics"]["coal_combined_thickness_m"] == 1.5
        assert result["metrics"]["seam_markers"] == ["S1"]
        assert result["metrics"]["source_imports"] == 1
        assert result["metrics"]["source_files"] == 1
        assert result["metrics"]["curve_coverage"][0]["sample_count"] == 2
        assert result["metrics"]["open_suggestion_count"] == 0
        assert result["metrics"]["review_focus"][0]["title"] == "missing rqd data"
        assert result["metrics"]["review_focus"][0]["priority"] == "review"
    finally:
        db.close()


def _test_session() -> Session:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)()


def _seed_borehole(db: Session) -> Borehole:
    project = Project(code="UAT", name="UAT Project")
    site = Site(code="SITE-01", name="Site 01", project=project)
    borehole = Borehole(
        code="MGCA-TEST",
        title="MGCA Test",
        total_depth=10,
        workflow_status="imported_for_central_review",
        site=site,
        lithology_intervals=[
            LithologyInterval(
                id="mgca-test-lith-1",
                from_depth=0.0,
                to_depth=1.5,
                lithology_code="COAL",
                lithology_label="Coal",
                seam_name="S1",
            ),
            LithologyInterval(
                id="mgca-test-lith-2",
                from_depth=1.5,
                to_depth=10.0,
                lithology_code="SH",
                lithology_label="Shale",
            ),
        ],
        seam_intervals=[
            SeamInterval(id="mgca-test-seam-1", name="S1", from_depth=0.0, to_depth=1.5, thickness=1.5)
        ],
        curves=[
            Curve(
                key="gamma",
                label="Natural Gamma",
                unit="API",
                source_type="las",
                color="#d97706",
                samples=[CurveSample(depth=0.0, value=45), CurveSample(depth=1.0, value=50)],
            )
        ],
        source_imports=[
            SourceImport(import_type="excel", source_name="RelianceData/Data_10BH.zip", status="imported")
        ],
        source_files=[
            SourceFile(file_type="las", original_name="MGCA-TEST.las", storage_path="uploads/MGCA-TEST.las")
        ],
        validation_issues=[
            ValidationIssue(code="missing_rqd_data", severity="warning", message="RQD missing", status="open")
        ],
    )
    db.add(project)
    db.commit()
    db.refresh(borehole)
    return borehole
