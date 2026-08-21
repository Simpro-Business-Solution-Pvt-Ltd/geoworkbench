from types import SimpleNamespace

from app.db.models import ExportProfile
from app.domains.exports.service import _column_mapping, _curve_keys_from_profile, _in_depth_range, _interval_value


def test_column_mapping_accepts_dict_templates_and_falls_back_when_empty() -> None:
    fallback = [("lithology.from_depth", "from_depth")]
    profile = ExportProfile(
        name="Custom",
        export_type="corrected_lithology_csv",
        mapping={
            "columns": [
                {"source": "borehole.code", "target": "Borehole"},
                {"key": "lithology.attributes.weathering", "label": "Weathering"},
            ]
        },
    )

    assert _column_mapping(profile, fallback) == [
        ("borehole.code", "Borehole"),
        ("lithology.attributes.weathering", "Weathering"),
    ]
    assert _column_mapping(ExportProfile(name="Empty", export_type="x", mapping={"columns": []}), fallback) == fallback


def test_interval_value_reads_canonical_fields_and_extension_attributes() -> None:
    borehole = SimpleNamespace(code="BH-01", title="Borehole 01")
    interval = SimpleNamespace(
        source_row=12,
        from_depth=10.0,
        to_depth=12.5,
        lithology_code="COAL",
        lithology_label="Coal",
        logged_color="black",
        seam_name="A",
        recovery=2.3,
        recovery_percent=92,
        rqd=0.76,
        structural_features="fractured",
        remark="sample",
        attributes={"weathering": "fresh"},
    )

    assert _interval_value(borehole, interval, "borehole.code") == "BH-01"
    assert _interval_value(borehole, interval, "lithology.thickness") == 2.5
    assert _interval_value(borehole, interval, "lithology.rqd_percent") == 76
    assert _interval_value(borehole, interval, "lithology.attributes.weathering") == "fresh"


def test_depth_range_filter_uses_interval_overlap() -> None:
    interval = SimpleNamespace(from_depth=10.0, to_depth=20.0)

    assert _in_depth_range(interval, None, None)
    assert _in_depth_range(interval, 5.0, 11.0)
    assert _in_depth_range(interval, 19.0, 30.0)
    assert not _in_depth_range(interval, 0.0, 10.0)
    assert not _in_depth_range(interval, 20.0, 30.0)


def test_curve_keys_from_profile_returns_optional_filter_set() -> None:
    assert _curve_keys_from_profile(None) is None
    assert _curve_keys_from_profile(ExportProfile(name="All", export_type="curves_csv", mapping={})) is None
    assert _curve_keys_from_profile(
        ExportProfile(name="Subset", export_type="curves_csv", mapping={"curves": ["GR", "RES", ""]})
    ) == {"GR", "RES"}
