from app.db.models import Borehole, CoreImage, LithologyInterval
from app.services.validation.borehole_validation import validate_borehole


def test_missing_corebox_package_is_not_a_validation_issue() -> None:
    borehole = _borehole()

    findings = validate_borehole(borehole)

    assert "core_images_not_loaded" not in {finding.code for finding in findings}
    assert "missing_core_image_link" not in {finding.code for finding in findings}


def test_partial_corebox_links_are_flagged_when_core_images_exist() -> None:
    borehole = _borehole()
    borehole.core_images.append(
        CoreImage(box_number=1, name="box-1.jpg", file_path="box-1.jpg", from_depth=0.0, to_depth=1.0)
    )
    borehole.lithology_intervals[0].image_box = 1

    findings = validate_borehole(borehole)

    missing_links = [finding for finding in findings if finding.code == "missing_core_image_link"]
    assert len(missing_links) == 1
    assert missing_links[0].entity_id == "bh-core-01-lith-2"


def test_supplied_core_image_without_depth_mapping_is_flagged() -> None:
    borehole = _borehole()
    borehole.core_images.append(CoreImage(box_number=1, name="box-1.jpg", file_path="box-1.jpg"))

    findings = validate_borehole(borehole)

    assert "core_image_depth_mapping_missing" in {finding.code for finding in findings}


def _borehole() -> Borehole:
    return Borehole(
        code="BH-CORE-01",
        title="BH-CORE-01",
        total_depth=2.0,
        workflow_status="ready_for_central_review",
        lithology_intervals=[
            LithologyInterval(
                id="bh-core-01-lith-1",
                from_depth=0.0,
                to_depth=1.0,
                lithology_code="SH",
                lithology_label="Shale",
            ),
            LithologyInterval(
                id="bh-core-01-lith-2",
                from_depth=1.0,
                to_depth=2.0,
                lithology_code="COAL",
                lithology_label="Coal",
            ),
        ],
    )

