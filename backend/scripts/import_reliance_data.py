import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(REPO_ROOT / "backend"))

from app.db.init_db import init_db  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.services.reliance_import import import_reliance_dataset, profile_reliance_dataset  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Profile or import Reliance consolidated borehole data.")
    parser.add_argument(
        "--data-root",
        default=str(REPO_ROOT / "RelianceData" / "_extracted" / "Data_10BH" / "Data_10BH"),
        help="Folder containing Reliance consolidated Excel files.",
    )
    parser.add_argument(
        "--las-root",
        default=str(REPO_ROOT / "RelianceData" / "_extracted" / "LAS" / "LAS"),
        help="Folder containing Reliance LAS files.",
    )
    parser.add_argument("--profile-only", action="store_true", help="Only profile the source package.")
    args = parser.parse_args()

    data_root = Path(args.data_root)
    las_root = Path(args.las_root) if args.las_root else None
    if not data_root.exists():
        raise SystemExit(f"Data root does not exist: {data_root}")
    if las_root is not None and not las_root.exists():
        raise SystemExit(f"LAS root does not exist: {las_root}")

    if args.profile_only:
        print(json.dumps(profile_reliance_dataset(data_root, las_root), indent=2, default=str))
        return

    init_db()
    with SessionLocal() as db:
        result = import_reliance_dataset(db, data_root, las_root)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
