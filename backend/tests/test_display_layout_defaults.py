from app.domains.display_layouts.defaults import default_borehole_layout


def test_default_borehole_layout_uses_current_runtime_regions() -> None:
    layout = default_borehole_layout()

    assert layout["schemaVersion"] == 2
    assert layout["regions"]["right"] == ["interval-details", "curve-catalog"]
    assert "export-panel" not in layout["widgets"]


def test_default_curve_track_is_ready_for_real_las_curves() -> None:
    layout = default_borehole_layout()
    tracks = layout["widgets"]["log-widget"]["tracks"]
    curve_track = next(track for track in tracks if track["type"] == "curve")

    assert curve_track["curves"] == []
