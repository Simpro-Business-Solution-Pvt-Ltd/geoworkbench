from app.services.curve_dictionary import curve_dictionary_mapping, curve_presentation, normalize_curve_key


def test_normalize_known_curve_mnemonics():
    assert normalize_curve_key("NGAM") == "gamma"
    assert normalize_curve_key("RES") == "resistivity"
    assert normalize_curve_key("RHOB") == "density"
    assert normalize_curve_key("DEPT") == "depth"


def test_unknown_curve_still_imports_as_unmapped():
    label, unit, color, metadata = curve_presentation("XYZ", "cps", "Custom signal")

    assert label == "Custom signal"
    assert unit == "cps"
    assert color == "#64748b"
    assert metadata["curve_family"] == "unmapped"
    assert metadata["mapping_status"] == "unmapped"


def test_known_curve_presentation_preserves_source_unit():
    label, unit, color, metadata = curve_presentation("NGAM", "CPS", "Natural Gamma")

    assert label == "Natural Gamma"
    assert unit == "CPS"
    assert color == "#ef4444"
    assert metadata["curve_family"] == "gamma-ray"
    assert metadata["mapping_status"] == "mapped"
    assert metadata["canonical_key"] == "gamma"


def test_curve_dictionary_mapping_is_template_friendly():
    mapping = curve_dictionary_mapping()

    assert "gamma" in mapping
    assert "NGAM" in mapping["gamma"]
    assert "resistivity" in mapping
    assert "RES" in mapping["resistivity"]
