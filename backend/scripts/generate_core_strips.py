import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from PIL import Image, ImageOps
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import Borehole, CoreImage
from app.db.session import SessionLocal


LANE_CROPS = [
    (0.060, 0.120, 0.920, 0.235),
    (0.060, 0.335, 0.920, 0.445),
    (0.060, 0.540, 0.920, 0.650),
    (0.060, 0.765, 0.920, 0.880),
]


def source_image_path(core_root: Path, image: CoreImage) -> Path:
    raw = Path(image.file_path or image.name)
    if raw.is_absolute():
        return raw
    if raw.name == image.name:
        return core_root / image.name
    return (get_settings().repo_root / raw).resolve()


def extract_strip(source: Path, target: Path, target_width: int = 220, target_lane_height: int = 360) -> dict:
    original = Image.open(source).convert("RGB")
    original = ImageOps.exif_transpose(original)
    width, height = original.size
    segments: list[Image.Image] = []
    lanes = []
    for lane_number, (left, top, right, bottom) in enumerate(LANE_CROPS, start=1):
        crop = original.crop(
            (
                int(width * left),
                int(height * top),
                int(width * right),
                int(height * bottom),
            )
        )
        rotated = crop.rotate(90, expand=True)
        resized = rotated.resize((target_width, target_lane_height), Image.Resampling.LANCZOS)
        segments.append(resized)
        lanes.append(
            {
                "lane_number": lane_number,
                "source_crop_relative": {
                    "left": left,
                    "top": top,
                    "right": right,
                    "bottom": bottom,
                },
                "source_crop_pixels": {
                    "left": int(width * left),
                    "top": int(height * top),
                    "right": int(width * right),
                    "bottom": int(height * bottom),
                },
                "rotation_degrees": 90,
                "display_height_px": target_lane_height,
            }
        )

    total_height = sum(segment.height for segment in segments)
    strip = Image.new("RGB", (target_width, total_height), "#111820")
    y = 0
    for segment in segments:
        strip.paste(segment, (0, y))
        y += segment.height
    target.parent.mkdir(parents=True, exist_ok=True)
    strip.save(target, "JPEG", quality=82, optimize=True)
    return {
        "strip_width_px": target_width,
        "strip_height_px": total_height,
        "lane_count": len(segments),
        "lanes": lanes,
        "method": "manual_relative_four_lane_crop_v1",
        "requires_geologist_confirmation": True,
    }


def main() -> None:
    settings = get_settings()
    core_root = settings.repo_root / "MTSE-65(PBH 62)"
    db = SessionLocal()
    try:
        borehole = db.scalar(select(Borehole).where(Borehole.code == "PBH-62"))
        if borehole is None:
            raise RuntimeError("PBH-62 is not seeded.")
        images = list(
            db.scalars(
                select(CoreImage)
                .where(CoreImage.borehole_id == borehole.id)
                .order_by(CoreImage.box_number)
            )
        )
        generated = 0
        skipped = 0
        manifest = {
            "borehole_code": borehole.code,
            "artifact_type": "core_depth_strips",
            "method": "manual_relative_four_lane_crop_v1",
            "summary": (
                "Each corebox tray photograph is converted into a depth-ordered strip by cropping "
                "the four tray lanes, rotating each lane by 90 degrees, and stacking them in lane order."
            ),
            "boxes": [],
        }
        for image in images:
            source = source_image_path(core_root, image)
            if not source.exists() or source.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                skipped += 1
                continue
            target = core_root / "core-strips" / borehole.code / f"{image.box_number:03d}.jpg"
            strip_metadata = extract_strip(source, target)
            image.image_metadata = {
                **(image.image_metadata or {}),
                "strip_image": str(target.relative_to(settings.repo_root)),
                "strip_processing": strip_metadata,
            }
            db.add(image)
            manifest["boxes"].append(
                {
                    "box_number": image.box_number,
                    "from_depth": image.from_depth,
                    "to_depth": image.to_depth,
                    "source_image": str(source.relative_to(settings.repo_root)),
                    "strip_image": str(target.relative_to(settings.repo_root)),
                    **strip_metadata,
                }
            )
            generated += 1
        manifest_path = core_root / "core-strips" / borehole.code / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        db.commit()
        print(f"Generated {generated} core strip image(s); skipped {skipped}.")
        print(f"Wrote {manifest_path}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
