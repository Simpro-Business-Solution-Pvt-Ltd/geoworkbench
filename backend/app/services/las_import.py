import re
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Borehole, Curve, CurveSample, SourceImport
from app.services.curve_dictionary import curve_presentation, normalize_curve_key
from app.services.data_stage import RAW_IMPORTED, merge_stage_metadata


@dataclass(frozen=True)
class LasCurveDef:
    mnemonic: str
    unit: str
    description: str


def _parse_mnemonic_line(line: str) -> tuple[str, str, str, str] | None:
    if not line or line.startswith("#"):
        return None
    left, _, description = line.partition(":")
    left = left.strip()
    description = description.strip()
    if "." not in left:
        return None
    mnemonic, rest = left.split(".", 1)
    parts = rest.strip().split(None, 1)
    unit = parts[0].strip() if parts else ""
    value = parts[1].strip() if len(parts) > 1 else ""
    return mnemonic.strip(), unit, value, description


def _to_float(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def parse_las_file(path: Path) -> dict:
    section = ""
    curve_defs: list[LasCurveDef] = []
    well: dict[str, str | float] = {}
    rows: list[list[float | None]] = []
    null_value = -99999.0

    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("~"):
            section = line[1:2].upper()
            continue
        if section == "W":
            parsed = _parse_mnemonic_line(line)
            if parsed is None:
                continue
            mnemonic, unit, value, description = parsed
            key = mnemonic.upper()
            numeric_value = _to_float(value)
            if key == "NULL" and numeric_value is None:
                numeric_value = _to_float(unit)
            well[key] = numeric_value if numeric_value is not None else (value or description)
            if key == "NULL" and numeric_value is not None:
                null_value = numeric_value
        elif section == "C":
            parsed = _parse_mnemonic_line(line)
            if parsed is None:
                continue
            mnemonic, unit, _value, description = parsed
            curve_defs.append(LasCurveDef(mnemonic=mnemonic, unit=unit, description=description))
        elif section == "A":
            values = [_to_float(part) for part in re.split(r"[\s,]+", line) if part]
            if values:
                rows.append(values)

    if not curve_defs and rows:
        curve_defs = [
            LasCurveDef("DEPT" if index == 0 else f"CURVE_{index}", "", "")
            for index in range(len(rows[0]))
        ]

    if not curve_defs or not rows:
        raise ValueError("LAS file does not contain curve definitions and ASCII samples.")

    width = min(len(curve_defs), max(len(row) for row in rows))
    curve_defs = curve_defs[:width]
    clean_rows: list[list[float | None]] = []
    for row in rows:
        padded = (row + [None] * width)[:width]
        clean_rows.append(
            [
                None
                if value is None or abs(value - null_value) < 1e-9
                else value
                for value in padded
            ]
        )

    depth_index = 0
    for index, curve_def in enumerate(curve_defs):
        if normalize_curve_key(curve_def.mnemonic, curve_def.description) == "depth":
            depth_index = index
            break

    depth_values = [row[depth_index] for row in clean_rows if row[depth_index] is not None]
    data_curves = []
    used_keys: dict[str, int] = {}
    for index, curve_def in enumerate(curve_defs):
        if index == depth_index:
            continue
        base_key = normalize_curve_key(curve_def.mnemonic, curve_def.description)
        used_keys[base_key] = used_keys.get(base_key, 0) + 1
        key = base_key if used_keys[base_key] == 1 else f"{base_key}_{curve_def.mnemonic.lower()}"
        values = [
            row[index]
            for row in clean_rows
            if row[depth_index] is not None and row[index] is not None
        ]
        label, unit, color, dictionary = curve_presentation(curve_def.mnemonic, curve_def.unit, curve_def.description)
        data_curves.append(
            {
                "index": index,
                "mnemonic": curve_def.mnemonic,
                "key": key,
                "label": label,
                "unit": unit,
                "color": color,
                "description": curve_def.description,
                "dictionary": dictionary,
                "sample_count": len(values),
                "min": min(values) if values else None,
                "max": max(values) if values else None,
            }
        )

    return {
        "parser": "las_profile",
        "file": path.name,
        "well": well,
        "null_value": null_value,
        "depth_index": depth_index,
        "rows": clean_rows,
        "curve_defs": curve_defs,
        "curves": data_curves,
        "summary": {
            "curve_count": len(data_curves),
            "sample_rows": len(clean_rows),
            "min_depth": min(depth_values) if depth_values else None,
            "max_depth": max(depth_values) if depth_values else None,
        },
    }


def profile_las_file(path: Path) -> dict:
    parsed = parse_las_file(path)
    return {
        "parser": "las_profile",
        "file": parsed["file"],
        "well": parsed["well"],
        "summary": parsed["summary"],
        "curves": [
            {key: curve[key] for key in ["mnemonic", "key", "label", "unit", "sample_count", "min", "max"]}
            for curve in parsed["curves"]
        ],
    }


def _replacement_keys(imported_keys: set[str]) -> set[str]:
    keys = set(imported_keys)
    if "gamma" in imported_keys:
        keys.update({"ng", "ngam"})
    if "ngam" in imported_keys or "ng" in imported_keys:
        keys.add("gamma")
    if "resistivity" in imported_keys:
        keys.update({"rs", "res"})
    if "caliper" in imported_keys:
        keys.update({"cl", "cal"})
    return keys


def import_las_curves(
    db: Session,
    borehole: Borehole,
    las_path: Path,
    *,
    replace_existing: bool = True,
) -> dict:
    parsed = parse_las_file(las_path)
    depth_index = parsed["depth_index"]
    imported_keys = _replacement_keys({curve["key"] for curve in parsed["curves"] if curve["sample_count"] > 0})

    if replace_existing:
        for curve in list(borehole.curves):
            if curve.key in imported_keys:
                borehole.curves.remove(curve)
                db.delete(curve)
        db.flush()
    existing_keys = {curve.key for curve in borehole.curves}

    created = []
    for curve_info in parsed["curves"]:
        if curve_info["sample_count"] == 0:
            continue
        if not replace_existing and curve_info["key"] in existing_keys:
            continue
        curve = Curve(
            borehole=borehole,
            key=curve_info["key"],
            label=curve_info["label"],
            unit=curve_info["unit"],
            source_type="las",
            color=curve_info["color"],
            curve_metadata=merge_stage_metadata(
                {
                    "mnemonic": curve_info["mnemonic"],
                    "description": curve_info["description"],
                    **curve_info["dictionary"],
                    "source_sample_count": curve_info["sample_count"],
                    "source_file": las_path.name,
                },
                RAW_IMPORTED,
                source_type="las",
                source_name=las_path.name,
            ),
        )
        borehole.curves.append(curve)
        db.add(curve)
        db.flush()
        sample_rows = []
        for row in parsed["rows"]:
            depth = row[depth_index]
            value = row[curve_info["index"]]
            if depth is None or value is None:
                continue
            sample_rows.append(
                {
                    "curve_id": curve.id,
                    "depth": round(depth, 4),
                    "value": round(value, 6),
                }
            )
        if sample_rows:
            db.bulk_insert_mappings(CurveSample, sample_rows)
        created.append(
            {
                "key": curve.key,
                "label": curve.label,
                "unit": curve.unit,
                "color": curve.color,
                "samples": len(sample_rows),
                "mnemonic": curve_info["mnemonic"],
                "min": curve_info["min"],
                "max": curve_info["max"],
            }
        )

    summary = {
        "merge_mode": "las_curves",
        "message": "LAS depth-indexed geophysical curves were merged into the borehole.",
        "file": las_path.name,
        "well": parsed["well"],
        "depth_range": {
            "from": parsed["summary"]["min_depth"],
            "to": parsed["summary"]["max_depth"],
        },
        "curves": created,
        "storage": {"source_samples_preserved": True},
        "replace_existing": replace_existing,
    }
    borehole.source_imports.append(
        SourceImport(
            import_type="las",
            source_name=las_path.name,
            status="merged",
            summary=summary,
        )
    )
    borehole.workflow_status = "imported_with_las_merge"
    db.add(borehole)
    db.commit()
    return summary


def display_curve_samples(
    db: Session,
    curve: Curve,
    *,
    max_samples: int = 6000,
) -> tuple[list[CurveSample], dict]:
    sample_count = db.scalar(select(func.count(CurveSample.id)).where(CurveSample.curve_id == curve.id)) or 0
    if sample_count <= max_samples:
        samples = list(
            db.scalars(
                select(CurveSample)
                .where(CurveSample.curve_id == curve.id)
                .order_by(CurveSample.depth)
            )
        )
        return samples, {"full_sample_count": sample_count, "display_sample_count": len(samples), "display_mode": "full"}

    step = max(1, sample_count // max_samples)
    samples = list(
        db.scalars(
            select(CurveSample)
            .where(CurveSample.curve_id == curve.id)
            .where(CurveSample.id % step == 0)
            .order_by(CurveSample.depth)
        )
    )
    return samples, {
        "full_sample_count": sample_count,
        "display_sample_count": len(samples),
        "display_mode": "decimated_for_workbench",
        "decimation_step": step,
    }
