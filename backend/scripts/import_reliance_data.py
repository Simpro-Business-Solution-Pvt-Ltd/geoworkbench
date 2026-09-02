import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(REPO_ROOT / "backend"))

from app.db.init_db import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.reliance_import import import_reliance_dataset, profile_reliance_dataset  # noqa: E402

REQUIRED_EXCEL_FILES = {
    "Collar_10BH.xlsx",
    "Lithology_10BH.xlsx",
    "Dirt_band_10BH.xlsx",
    "Band_by_band_10BH.xlsx",
    "Overall analysis_10BH.xlsx",
}


def _candidate_roots() -> list[Path]:
    return [
        REPO_ROOT / "RelianceData" / "_extracted" / "Data_10BH" / "Data_10BH",
        REPO_ROOT / "RelianceData" / "_extracted" / "Data_10BH",
        Path(r"C:\GeoWorkbench\data\Data_10BH"),
        Path(r"C:\GeoWorkbench\data\reliance\Data_10BH"),
    ]


def _candidate_las_roots() -> list[Path]:
    return [
        REPO_ROOT / "RelianceData" / "_extracted" / "LAS" / "LAS",
        REPO_ROOT / "RelianceData" / "_extracted" / "LAS",
        Path(r"C:\GeoWorkbench\data\LAS"),
        Path(r"C:\GeoWorkbench\data\reliance\LAS"),
    ]


def _has_required_excels(path: Path) -> bool:
    return path.exists() and all((path / name).exists() for name in REQUIRED_EXCEL_FILES)


def _resolve_data_root(path: Path | None) -> Path:
    candidates = [path] if path is not None else _candidate_roots()
    checked: list[Path] = []
    for candidate in [item for item in candidates if item is not None]:
        checked.append(candidate)
        if _has_required_excels(candidate):
            return candidate
        if candidate.exists():
            for child in candidate.rglob("Collar_10BH.xlsx"):
                child_root = child.parent
                checked.append(child_root)
                if _has_required_excels(child_root):
                    return child_root
    checked_text = "\n  - ".join(str(item) for item in checked)
    raise SystemExit(
        "Could not find the Reliance Excel workbook set. Expected these files in one folder: "
        f"{', '.join(sorted(REQUIRED_EXCEL_FILES))}\nChecked:\n  - {checked_text}"
    )


def _resolve_las_root(path: Path | None) -> Path | None:
    candidates = [path] if path is not None else _candidate_las_roots()
    checked: list[Path] = []
    for candidate in [item for item in candidates if item is not None]:
        checked.append(candidate)
        if candidate.exists() and any(candidate.glob("*.las")):
            return candidate
        if candidate.exists():
            for child in candidate.rglob("*.las"):
                return child.parent
    if path is not None:
        checked_text = "\n  - ".join(str(item) for item in checked)
        raise SystemExit(f"Could not find LAS files below:\n  - {checked_text}")
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile or import Reliance consolidated borehole data.")
    parser.add_argument(
        "--data-root",
        default=None,
        help="Folder containing Reliance Excel files, or a parent folder containing Data_10BH.",
    )
    parser.add_argument(
        "--las-root",
        default=None,
        help="Folder containing Reliance LAS files, or a parent folder containing LAS files.",
    )
    parser.add_argument("--profile-only", action="store_true", help="Only profile the source package.")
    args = parser.parse_args()

    data_root = _resolve_data_root(Path(args.data_root) if args.data_root else None)
    las_root = _resolve_las_root(Path(args.las_root) if args.las_root else None)
    print(f"Using data root: {data_root}")
    print(f"Using LAS root: {las_root or 'not found / skipped'}")

    if args.profile_only:
        print(json.dumps(profile_reliance_dataset(data_root, las_root), indent=2, default=str))
        return

    init_db()
    with SessionLocal() as db:
        result = import_reliance_dataset(db, data_root, las_root)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
