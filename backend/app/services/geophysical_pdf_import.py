from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from statistics import median

try:
    import fitz
except ImportError:  # pragma: no cover - handled at runtime for optional parser dependency
    fitz = None

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Borehole, Curve, CurveSample, SourceImport


@dataclass(frozen=True)
class PdfCurveSpec:
    key: str
    label: str
    unit: str
    color: tuple[float, float, float]
    track: str
    value_min: float
    value_max: float
    stroke_width: float | None = None


LEFT_TRACK = (12.5, 228.0)
RIGHT_TRACK = (300.5, 516.0)

PINNACLE_COMPOSITE_CURVES = [
    PdfCurveSpec("ngamma", "Natural Gamma", "API-GR", (1.0, 0.0, 0.0), "left", 0.0, 750.0, 0.849),
    PdfCurveSpec(
        "sp", "Spontaneous Potential", "mV", (0.5, 0.0, 0.5), "left", -300.0, 100.0, 0.849
    ),
    PdfCurveSpec(
        "calp_incl",
        "Caliper / Inclination Composite",
        "mixed",
        (0.0, 0.0, 1.0),
        "left",
        0.0,
        1.0,
        0.849,
    ),
    PdfCurveSpec("res", "Resistivity", "ohm", (0.0, 0.0, 0.547), "right", 0.0, 1000.0, 1.415),
    PdfCurveSpec("dens", "Density", "g/cc", (1.0, 0.0, 0.0), "right", 1.4, 3.0, 1.415),
    PdfCurveSpec(
        "spr",
        "Single Point Resistance",
        "ohm",
        (0.547, 0.547, 0.0),
        "right",
        0.0,
        500.0,
        0.849,
    ),
]


def _require_fitz():
    if fitz is None:
        raise RuntimeError(
            "PyMuPDF is required for PDF geophysical log import. Install package 'pymupdf'."
        )
    return fitz


def _same_color(left: tuple[float, float, float] | None, right: tuple[float, float, float]) -> bool:
    if left is None:
        return False
    return all(abs(left[index] - right[index]) < 0.01 for index in range(3))


def _depth_labels(page) -> list[tuple[float, float]]:
    labels: list[tuple[float, float]] = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = " ".join(span["text"] for span in line["spans"]).strip()
            if not re.fullmatch(r"\d+\.\d", text):
                continue
            x0, y0, x1, y1 = line["bbox"]
            if 245 <= x0 <= 280 and 730 <= y0 <= 6270:
                labels.append((float(text), (y0 + y1) / 2))
    return labels


def _fit_depth_axis(depth_labels: list[tuple[float, float]]) -> tuple[float, float, float]:
    if len(depth_labels) < 2:
        raise ValueError("Could not find enough depth labels to calibrate PDF depth axis.")
    count = len(depth_labels)
    sum_depth = sum(depth for depth, _ in depth_labels)
    sum_y = sum(y for _, y in depth_labels)
    sum_depth_y = sum(depth * y for depth, y in depth_labels)
    sum_depth_sq = sum(depth * depth for depth, _ in depth_labels)
    slope = (count * sum_depth_y - sum_depth * sum_y) / (
        count * sum_depth_sq - sum_depth * sum_depth
    )
    intercept = (sum_y - slope * sum_depth) / count
    residuals = [abs((slope * depth + intercept) - y) for depth, y in depth_labels]
    return slope, intercept, max(residuals)


def _drawing_points(drawing) -> list[tuple[float, float]]:
    points: list[tuple[float, float]] = []
    for item in drawing["items"]:
        if item[0] == "l":
            points.append((float(item[1].x), float(item[1].y)))
            points.append((float(item[2].x), float(item[2].y)))
        elif item[0] == "c":
            for point in item[1:]:
                points.append((float(point.x), float(point.y)))
    return points


def _track_limits(track: str) -> tuple[float, float]:
    return LEFT_TRACK if track == "left" else RIGHT_TRACK


def _value_from_x(x: float, spec: PdfCurveSpec) -> float | None:
    x_min, x_max = _track_limits(spec.track)
    if x < x_min - 8 or x > x_max + 8:
        return None
    clipped_x = max(x_min, min(x_max, x))
    ratio = (clipped_x - x_min) / (x_max - x_min)
    return spec.value_min + ratio * (spec.value_max - spec.value_min)


def _depth_from_y(y: float, slope: float, intercept: float) -> float:
    return (y - intercept) / slope


def _curve_samples_from_drawings(
    page, spec: PdfCurveSpec, slope: float, intercept: float
) -> list[dict]:
    bins: dict[float, list[float]] = {}
    raw_points = 0
    clipped_points = 0
    x_min, x_max = _track_limits(spec.track)
    for drawing in page.get_drawings():
        if not _same_color(drawing.get("color"), spec.color):
            continue
        if (
            spec.stroke_width is not None
            and abs(float(drawing.get("width") or 0) - spec.stroke_width) > 0.08
        ):
            continue
        rect = drawing["rect"]
        if rect.x1 < x_min - 20 or rect.x0 > x_max + 20:
            continue
        if rect.y1 < 730 or rect.y0 > 6270:
            continue
        for x, y in _drawing_points(drawing):
            if y < 730 or y > 6270:
                continue
            value = _value_from_x(x, spec)
            if value is None:
                clipped_points += 1
                continue
            depth = _depth_from_y(y, slope, intercept)
            if depth < 0 or depth > 393.5:
                continue
            depth_bin = round(depth * 2) / 2
            bins.setdefault(depth_bin, []).append(value)
            raw_points += 1

    samples = [
        {"depth": depth, "value": round(median(values), 4), "point_count": len(values)}
        for depth, values in sorted(bins.items())
        if values
    ]
    return samples, {
        "raw_points": raw_points,
        "clipped_points": clipped_points,
        "depth_bins": len(samples),
    }


def profile_pinnacle_composite_pdf(pdf_path: Path) -> dict:
    pymupdf = _require_fitz()
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    text = page.get_text()
    depth_labels = _depth_labels(page)
    slope, intercept, max_residual = _fit_depth_axis(depth_labels)
    drawings = page.get_drawings()

    return {
        "parser": "pinnacle_composite_pdf_profile",
        "source_name": pdf_path.name,
        "page_count": doc.page_count,
        "page_size": [round(page.rect.width, 2), round(page.rect.height, 2)],
        "metadata": {
            "well": "SPNG-05" if "SPNG-05" in text else None,
            "company": "CMPDI, Ranchi" if "CMPDI" in text else None,
            "field": "North Karanpura Coalfield" if "North Karanpura Coalfield" in text else None,
            "location": "Raham Coal Block" if "Raham Coal Block" in text else None,
            "country": "India" if "India" in text else None,
            "state": "Jharkhand" if "Jharkhand" in text else None,
            "logged_date": "24/01/2013" if "24/01/2013" in text else None,
            "depth_from": 0.0,
            "depth_to": 393.0,
            "services": ["DENSITY", "CALIPER", "N-GAMMA", "RESISTIVITY", "SP", "SPR", "INCL"],
            "source_system": "Pinnacle composite PDF export",
        },
        "calibration": {
            "depth_label_count": len(depth_labels),
            "depth_y_slope": slope,
            "depth_y_intercept": intercept,
            "max_depth_fit_error_points": max_residual,
            "left_track_x": list(LEFT_TRACK),
            "right_track_x": list(RIGHT_TRACK),
        },
        "drawing_summary": {
            "total_drawings": len(drawings),
            "vector_curve_candidates": len(
                [drawing for drawing in drawings if drawing.get("color") is not None]
            ),
        },
        "curves": [
            {
                "key": spec.key,
                "label": spec.label,
                "unit": spec.unit,
                "track": spec.track,
                "value_min": spec.value_min,
                "value_max": spec.value_max,
                "extraction_confidence": "medium" if spec.key != "calp_incl" else "low",
            }
            for spec in PINNACLE_COMPOSITE_CURVES
        ],
        "limitations": [
            "PDF extraction is digitized from plotted vectors and should be QA-reviewed before "
            "final correction/export.",
            "Raw LAS/CSV/DLIS from the logging contractor remains the preferred production input.",
            "Caliper and inclination share the same visible color/style in this export, so they "
            "are initially imported as a composite evidence curve.",
        ],
    }


def digitize_pinnacle_composite_pdf(pdf_path: Path) -> dict:
    pymupdf = _require_fitz()
    doc = pymupdf.open(pdf_path)
    page = doc[0]
    profile = profile_pinnacle_composite_pdf(pdf_path)
    slope = profile["calibration"]["depth_y_slope"]
    intercept = profile["calibration"]["depth_y_intercept"]

    curves = []
    for spec in PINNACLE_COMPOSITE_CURVES:
        samples, stats = _curve_samples_from_drawings(page, spec, slope, intercept)
        curves.append(
            {
                "key": spec.key,
                "label": spec.label,
                "unit": spec.unit,
                "source_type": "pinnacle_pdf_digitized",
                "color": {
                    "ngamma": "#ef4444",
                    "sp": "#8b5cf6",
                    "calp_incl": "#3b82f6",
                    "res": "#2563eb",
                    "dens": "#dc2626",
                    "spr": "#8a8a00",
                }[spec.key],
                "samples": samples,
                "stats": stats,
                "value_min": spec.value_min,
                "value_max": spec.value_max,
            }
        )
    return {**profile, "parser": "pinnacle_composite_pdf_digitized", "digitized_curves": curves}


def import_digitized_pdf_curves(
    db: Session,
    borehole: Borehole,
    pdf_path: Path,
    *,
    replace_existing: bool = True,
) -> dict:
    result = digitize_pinnacle_composite_pdf(pdf_path)
    existing_keys = {
        curve.key
        for curve in db.scalars(select(Curve).where(Curve.borehole_id == borehole.id))
    }
    for curve_data in result["digitized_curves"]:
        existing = db.scalar(
            select(Curve)
            .where(Curve.borehole_id == borehole.id)
            .where(Curve.key == curve_data["key"])
        )
        if existing is not None and replace_existing:
            db.delete(existing)
            db.flush()
        if existing is not None and not replace_existing and curve_data["key"] in existing_keys:
            continue
        curve = Curve(
            borehole_id=borehole.id,
            key=curve_data["key"],
            label=curve_data["label"],
            unit=curve_data["unit"],
            source_type=curve_data["source_type"],
            color=curve_data["color"],
        )
        curve.samples = [
            CurveSample(depth=sample["depth"], value=sample["value"])
            for sample in curve_data["samples"]
        ]
        db.add(curve)

    source_imports = list(
        db.scalars(
            select(SourceImport)
            .where(SourceImport.borehole_id == borehole.id)
            .where(SourceImport.import_type == "geophysical_pdf")
            .where(SourceImport.source_name == pdf_path.name)
        )
    )
    source_import = (
        source_imports[0]
        if source_imports
        else SourceImport(
            borehole_id=borehole.id,
            import_type="geophysical_pdf",
            source_name=pdf_path.name,
        )
    )
    for duplicate in source_imports[1:]:
        db.delete(duplicate)

    source_import.status = "digitized_for_review"
    source_import.summary = {
        "parser": result["parser"],
        "metadata": result["metadata"],
        "calibration": result["calibration"],
        "curves": [
            {
                "key": curve["key"],
                "label": curve["label"],
                "unit": curve["unit"],
                "samples": len(curve["samples"]),
                "stats": curve["stats"],
            }
            for curve in result["digitized_curves"]
        ],
        "limitations": result["limitations"],
        "replace_existing": replace_existing,
    }
    db.add(source_import)
    db.commit()
    return result
