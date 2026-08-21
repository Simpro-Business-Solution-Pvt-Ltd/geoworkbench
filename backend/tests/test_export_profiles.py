from app.db.models import ExportProfile
from app.domains.exports.service import default_export_profiles, refreshed_default_export_mapping


def test_default_export_profiles_cover_uat_formats() -> None:
    profiles = default_export_profiles()

    assert {profile.export_type for profile in profiles} == {
        "corrected_lithology_csv",
        "corrected_lithology_xlsx",
        "curves_csv",
        "curves_las",
    }


def test_default_export_profiles_include_mapping_details() -> None:
    profiles = {profile.export_type: profile for profile in default_export_profiles()}

    assert profiles["corrected_lithology_xlsx"].mapping["columns"]
    assert profiles["corrected_lithology_csv"].mapping["columns"]
    assert profiles["curves_las"].mapping["curve_dictionary"]
    assert profiles["curves_csv"].mapping["curve_dictionary"]


def test_default_corrected_lithology_csv_uses_canonical_sources() -> None:
    profile = {profile.export_type: profile for profile in default_export_profiles()}["corrected_lithology_csv"]
    columns = profile.mapping["columns"]

    assert all(isinstance(column, dict) for column in columns)
    assert {column["target"] for column in columns} >= {"borehole_code", "from_depth", "to_depth", "rqd_percent"}
    assert {column["source"] for column in columns} >= {
        "borehole.code",
        "lithology.from_depth",
        "lithology.to_depth",
        "lithology.rqd_percent",
    }


def test_default_export_profile_factory_returns_fresh_instances() -> None:
    first = default_export_profiles()
    second = default_export_profiles()

    assert first[0] is not second[0]
    assert first[0].mapping is not second[0].mapping


def test_legacy_corrected_lithology_csv_profile_mapping_is_refreshed() -> None:
    default = {profile.export_type: profile for profile in default_export_profiles()}["corrected_lithology_csv"]
    existing = ExportProfile(
        name=default.name,
        export_type=default.export_type,
        mapping={"columns": ["borehole_code", "from_depth", "to_depth", "rqd_percent"]},
    )

    refreshed = refreshed_default_export_mapping(existing, default)

    assert refreshed == default.mapping
