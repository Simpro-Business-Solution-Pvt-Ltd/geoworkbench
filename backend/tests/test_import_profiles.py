from app.db.models import ImportProfile
from app.domains.imports.service import default_import_profiles, refreshed_default_import_mapping, safe_filename


def test_default_import_profiles_cover_uat_sources() -> None:
    profiles = default_import_profiles()

    assert {profile.profile_type for profile in profiles} == {"excel", "geophysical_pdf", "images", "las"}
    assert {profile.name for profile in profiles} >= {
        "PBH Excel Workbook",
        "CTSJ Excel Workbook",
        "LAS Geophysical Curves",
        "Pinnacle Composite PDF",
        "Corebox Image Folder",
    }


def test_default_import_profiles_include_mapping_details() -> None:
    profiles = {profile.name: profile for profile in default_import_profiles()}

    assert profiles["PBH Excel Workbook"].mapping["lithology"]["from_depth"] == "E"
    assert profiles["CTSJ Excel Workbook"].mapping["lithology"]["from_depth"] == "F"
    assert profiles["LAS Geophysical Curves"].mapping["curve_dictionary"]
    assert profiles["Pinnacle Composite PDF"].mapping["tracks"]
    assert profiles["Corebox Image Folder"].mapping["depth_mapping"] == "manual_or_inferred"


def test_default_import_profile_factory_returns_fresh_instances() -> None:
    first = default_import_profiles()
    second = default_import_profiles()

    assert first[0] is not second[0]
    assert first[0].mapping is not second[0].mapping


def test_safe_filename_removes_path_and_unsafe_characters() -> None:
    assert safe_filename("../../CTSJ 02 P-27 composite!.las") == "CTSJ_02_P-27_composite_.las"
    assert safe_filename("...") == "upload.bin"


def test_legacy_excel_import_profile_mapping_is_refreshed_when_template_changes() -> None:
    default = {profile.name: profile for profile in default_import_profiles()}["CTSJ Excel Workbook"]
    existing = ImportProfile(
        name=default.name,
        profile_type=default.profile_type,
        mapping={"template_key": "old_ctsj_template", "lithology": {"from_depth": "A"}},
    )

    assert refreshed_default_import_mapping(existing, default) == default.mapping


def test_legacy_las_import_profile_keeps_mapping_and_adds_curve_dictionary() -> None:
    default = {profile.name: profile for profile in default_import_profiles()}["LAS Geophysical Curves"]
    existing = ImportProfile(
        name=default.name,
        profile_type=default.profile_type,
        mapping={"depth": "DEPT", "curves": ["GR"]},
    )

    refreshed = refreshed_default_import_mapping(existing, default)

    assert refreshed is not None
    assert refreshed["depth"] == "DEPT"
    assert refreshed["curves"] == ["GR"]
    assert refreshed["curve_dictionary"]
