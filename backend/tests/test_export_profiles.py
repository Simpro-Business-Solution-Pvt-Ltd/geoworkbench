from app.domains.exports.service import default_export_profiles


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


def test_default_export_profile_factory_returns_fresh_instances() -> None:
    first = default_export_profiles()
    second = default_export_profiles()

    assert first[0] is not second[0]
    assert first[0].mapping is not second[0].mapping
