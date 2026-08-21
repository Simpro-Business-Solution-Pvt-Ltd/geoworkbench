from copy import deepcopy

from app.domains.display_layouts.defaults import default_borehole_layout
from app.services.reliance_import import _configure_layout


def _track(layout: dict, track_id: str) -> dict:
    tracks = layout["widgets"]["log-widget"]["tracks"]
    return next(track for track in tracks if track["id"] == track_id)


def test_reliance_layout_keeps_missing_core_image_track_visible() -> None:
    layout = _configure_layout(deepcopy(default_borehole_layout()), [], has_core_images=False)

    assert _track(layout, "core-images")["visible"] is True


def test_reliance_layout_hides_rqd_when_source_data_has_no_rqd() -> None:
    layout = _configure_layout(deepcopy(default_borehole_layout()), [], has_core_images=False)

    assert _track(layout, "rqd")["visible"] is False


def test_reliance_layout_replaces_curve_track_with_las_curves() -> None:
    layout = _configure_layout(
        deepcopy(default_borehole_layout()),
        [
            {"key": "GR", "label": "Gamma Ray", "unit": "API", "min": 10, "max": 120, "color": "#ff0000"},
            {"key": "RHOB", "label": "Density", "unit": "g/cc", "min": 1.2, "max": 2.8, "color": "#00ff00"},
        ],
    )

    curve_track = _track(layout, "curves")
    assert [curve["curveKey"] for curve in curve_track["curves"]] == ["GR", "RHOB"]
    assert curve_track["curves"][0]["normalization"]["enabled"] is True
