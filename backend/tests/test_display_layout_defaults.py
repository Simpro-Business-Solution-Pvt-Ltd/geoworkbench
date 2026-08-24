from app.domains.display_layouts.defaults import default_borehole_layout


def test_default_borehole_layout_uses_current_runtime_regions() -> None:
    layout = default_borehole_layout()

    assert layout["schemaVersion"] == 5
    assert layout["regions"]["right"] == ["interval-details", "curve-catalog"]
    assert "export-panel" not in layout["widgets"]
    assert layout["widgets"]["interpretation-queue"]["type"] == "interpretationQueue"
    assert layout["widgets"]["evidence-coverage"]["type"] == "evidenceCoverage"
    assert "interpretation-queue" in {item["widgetId"] for item in layout["grid"]["items"]}
    assert "evidence-coverage" in {item["widgetId"] for item in layout["grid"]["items"]}


def test_default_curve_track_is_ready_for_real_las_curves() -> None:
    layout = default_borehole_layout()
    tracks = layout["widgets"]["log-widget"]["tracks"]
    curve_track = next(track for track in tracks if track["type"] == "curve")

    assert curve_track["curves"] == []


def test_default_borehole_layout_references_only_registered_widgets() -> None:
    layout = default_borehole_layout()
    widget_ids = set(layout["widgets"])
    grid_widget_ids = {item["widgetId"] for item in layout["grid"]["items"]}
    region_widget_ids = {widget_id for widget_ids_in_region in layout["regions"].values() for widget_id in widget_ids_in_region}

    assert grid_widget_ids <= widget_ids
    assert region_widget_ids <= widget_ids
