import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter, ImageOps
from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings
from app.db.models import Borehole, CoreImage, LithologyInterval
from app.db.session import SessionLocal


FOUR_LANE_TEMPLATE_WINDOWS = [
    (0.055, 0.080, 0.925, 0.285),
    (0.055, 0.285, 0.925, 0.505),
    (0.055, 0.500, 0.925, 0.725),
    (0.055, 0.715, 0.925, 0.975),
]
FIVE_LANE_TEMPLATE_WINDOWS = [
    (0.055, 0.060, 0.925, 0.235),
    (0.055, 0.225, 0.925, 0.400),
    (0.055, 0.400, 0.925, 0.575),
    (0.055, 0.575, 0.925, 0.750),
    (0.055, 0.750, 0.925, 0.935),
]
LANE_X_RANGE = (0.055, 0.925)
ROCK_LANE_BACKGROUND = (17, 24, 32)
PREVIEW_HEIGHT_PX = 1800
MASTER_JPEG_QUALITY = 92
PREVIEW_JPEG_QUALITY = 88
ROW_ACTIVITY_SAMPLE_WIDTH = 512


def source_image_path(core_root: Path, image: CoreImage) -> Path:
    raw = Path(image.file_path or image.name)
    if raw.is_absolute():
        return raw
    if raw.name == image.name:
        return core_root / image.name
    return (get_settings().repo_root / raw).resolve()


def rock_mask(crop: Image.Image) -> Image.Image:
    hsv = crop.convert("HSV")
    hue, saturation, value = hsv.split()
    red, _green, blue = crop.split()

    saturated = saturation.point(lambda item: 255 if item >= 18 else 0)
    lit = value.point(lambda item: 255 if 38 <= item <= 246 else 0)
    warm_delta = ImageChops.subtract(red, blue, offset=128)
    warm = warm_delta.point(lambda item: 255 if item >= 112 else 0)
    neutral_lit = value.point(lambda item: 255 if 95 <= item <= 238 else 0)
    neutral_texture = saturation.point(lambda item: 255 if item >= 5 else 0)
    dark_lit = value.point(lambda item: 255 if 42 <= item <= 110 else 0)
    dark_texture = saturation.point(lambda item: 255 if item >= 18 else 0)

    warm_mask = ImageChops.multiply(saturated, lit)
    warm_mask = ImageChops.multiply(warm_mask, warm)
    neutral_mask = ImageChops.multiply(neutral_lit, neutral_texture)
    dark_mask = ImageChops.multiply(dark_lit, dark_texture)
    mask = ImageChops.lighter(warm_mask, neutral_mask)
    mask = ImageChops.lighter(mask, dark_mask)
    mask = mask.filter(ImageFilter.MaxFilter(5))
    mask = mask.filter(ImageFilter.MinFilter(3))
    return mask


def coverage_rows(mask: Image.Image, sample_width: int = 384) -> list[float]:
    sample = mask.resize((sample_width, mask.height), Image.Resampling.NEAREST)
    pixels = sample.tobytes()
    rows = []
    for y in range(sample.height):
        row = pixels[y * sample_width : (y + 1) * sample_width]
        rows.append(sum(1 for item in row if item > 0) / sample_width)
    return rows


def coverage_columns(mask: Image.Image, sample_height: int = 128) -> list[float]:
    sample = mask.resize((mask.width, sample_height), Image.Resampling.NEAREST)
    pixels = sample.tobytes()
    columns = []
    for x in range(sample.width):
        columns.append(
            sum(1 for y in range(sample_height) if pixels[y * sample.width + x] > 0)
            / sample_height
        )
    return columns


def moving_average(values: list[float], radius: int) -> list[float]:
    if radius <= 0 or not values:
        return values
    prefix = [0.0]
    for value in values:
        prefix.append(prefix[-1] + value)
    smoothed = []
    for index in range(len(values)):
        start = max(0, index - radius)
        end = min(len(values), index + radius + 1)
        smoothed.append((prefix[end] - prefix[start]) / (end - start))
    return smoothed


def quantile(values: list[float], fraction: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, int((len(ordered) - 1) * fraction)))
    return ordered[index]


def row_activity_scores(
    original: Image.Image,
    sample_width: int = ROW_ACTIVITY_SAMPLE_WIDTH,
) -> list[float]:
    width, height = original.size
    left, right = LANE_X_RANGE
    sample = original.crop(
        (
            int(width * left),
            0,
            int(width * right),
            height,
        )
    ).resize((sample_width, height), Image.Resampling.BILINEAR)
    hsv = sample.convert("HSV")
    hue, saturation, value = hsv.split()
    red, green, blue = sample.split()
    hue_bytes = hue.tobytes()
    saturation_bytes = saturation.tobytes()
    value_bytes = value.tobytes()
    red_bytes = red.tobytes()
    green_bytes = green.tobytes()
    blue_bytes = blue.tobytes()

    scores = []
    for y in range(height):
        row_start = y * sample_width
        row_end = row_start + sample_width
        active = 0
        for index in range(row_start, row_end):
            hue_value = hue_bytes[index]
            saturation_value = saturation_bytes[index]
            value_value = value_bytes[index]
            red_value = red_bytes[index]
            green_value = green_bytes[index]
            blue_value = blue_bytes[index]

            if value_value < 38:
                continue
            if value_value > 248 and saturation_value < 12:
                continue
            if red_value < 32 and green_value < 32 and blue_value < 32:
                continue
            if 112 <= hue_value <= 178 and saturation_value > 52:
                continue
            active += 1
        scores.append(active / sample_width)
    return moving_average(scores, max(8, height // 130))


def detected_activity_bands(original: Image.Image) -> tuple[list[dict], dict]:
    scores = row_activity_scores(original)
    height = len(scores)
    if not scores:
        return [], {"threshold": 0.0, "q20": 0.0, "q80": 0.0}

    inner = scores[int(height * 0.04) : int(height * 0.96)] or scores
    q20 = quantile(inner, 0.20)
    q80 = quantile(inner, 0.80)
    threshold = max(0.16, q20 + (q80 - q20) * 0.28)
    raw_bands: list[dict] = []
    start = None
    score_sum = 0.0
    min_height = max(8, int(height * 0.032))

    for index, score in enumerate(scores):
        if score >= threshold:
            if start is None:
                start = index
                score_sum = 0.0
            score_sum += score
        elif start is not None:
            if index - start >= min_height:
                raw_bands.append(
                    {
                        "start": start,
                        "end": index,
                        "score": score_sum / (index - start),
                    }
                )
            start = None
    if start is not None and height - start >= min_height:
        raw_bands.append(
            {
                "start": start,
                "end": height,
                "score": score_sum / (height - start),
            }
        )

    bands = normalise_activity_bands(raw_bands, height)
    diagnostics = {
        "threshold": threshold,
        "q20": q20,
        "q80": q80,
        "raw_band_count": len(raw_bands),
    }
    return bands, diagnostics


def normalise_activity_bands(bands: list[dict], image_height: int) -> list[dict]:
    if not bands:
        return []
    ordered = sorted(bands, key=lambda item: item["start"])
    merged: list[dict] = []
    merge_gap = image_height * 0.028
    for band in ordered:
        if merged and band["start"] - merged[-1]["end"] <= merge_gap:
            previous = merged.pop()
            total_height = (previous["end"] - previous["start"]) + (band["end"] - band["start"])
            merged.append(
                {
                    "start": previous["start"],
                    "end": band["end"],
                    "score": (
                        previous["score"] * (previous["end"] - previous["start"])
                        + band["score"] * (band["end"] - band["start"])
                    )
                    / max(1, total_height),
                }
            )
        else:
            merged.append(dict(band))

    min_height = image_height * 0.035
    filtered = [band for band in merged if band["end"] - band["start"] >= min_height]

    while len(filtered) > 5:
        closest_index = min(
            range(len(filtered) - 1),
            key=lambda index: band_center(filtered[index + 1]) - band_center(filtered[index]),
        )
        left = filtered[closest_index]
        right = filtered[closest_index + 1]
        center_gap = band_center(right) - band_center(left)
        if center_gap > image_height * 0.13:
            break
        left_height = left["end"] - left["start"]
        right_height = right["end"] - right["start"]
        if band_center(right) / image_height > 0.90:
            remove_index = closest_index + 1
        elif left_height < right_height * 0.72:
            remove_index = closest_index
        elif right_height < left_height * 0.72:
            remove_index = closest_index + 1
        elif left["score"] <= right["score"]:
            remove_index = closest_index
        else:
            remove_index = closest_index + 1
        filtered.pop(remove_index)

    return [
        {
            **band,
            "start_ratio": band["start"] / image_height,
            "end_ratio": band["end"] / image_height,
            "center_ratio": band_center(band) / image_height,
            "height_ratio": (band["end"] - band["start"]) / image_height,
        }
        for band in filtered
        if 0.06 <= band_center(band) / image_height <= 0.97
    ]


def band_center(band: dict) -> float:
    return (band["start"] + band["end"]) / 2


def select_lane_bands(bands: list[dict], lane_count: int) -> list[dict]:
    if len(bands) <= lane_count:
        return bands
    best: tuple[float, list[dict]] | None = None

    def combinations(items: list[dict], size: int, offset: int = 0) -> list[list[dict]]:
        if size == 0:
            return [[]]
        if len(items) - offset < size:
            return []
        result = []
        for index in range(offset, len(items) - size + 1):
            for suffix in combinations(items, size - 1, index + 1):
                result.append([items[index], *suffix])
        return result

    for candidate in combinations(bands, lane_count):
        centers = [item["center_ratio"] for item in candidate]
        gaps = [centers[index + 1] - centers[index] for index in range(len(centers) - 1)]
        if not gaps:
            continue
        average_gap = sum(gaps) / len(gaps)
        if min(gaps) < 0.10:
            continue
        regularity_penalty = sum(abs(gap - average_gap) for gap in gaps) / average_gap
        score = sum(item["score"] for item in candidate) / len(candidate) - regularity_penalty * 0.08
        if best is None or score > best[0]:
            best = (score, candidate)
    return best[1] if best is not None else bands[:lane_count]


def template_windows_for_lane_count(lane_count: int) -> list[tuple[float, float, float, float]]:
    return FIVE_LANE_TEMPLATE_WINDOWS if lane_count == 5 else FOUR_LANE_TEMPLATE_WINDOWS


def windows_from_bands(bands: list[dict]) -> list[tuple[float, float, float, float]]:
    windows = []
    for band in bands:
        center = band["center_ratio"]
        top = max(0.0, band["start_ratio"] - 0.015)
        bottom = min(1.0, band["end_ratio"] + 0.015)
        if bottom - top < 0.09:
            top = max(0.0, center - 0.055)
            bottom = min(1.0, center + 0.055)
        windows.append((LANE_X_RANGE[0], top, LANE_X_RANGE[1], bottom))
    return windows


def resolve_lane_windows(
    original: Image.Image,
    box_number: int,
    five_lane_from_box: int | None,
) -> tuple[list[tuple[float, float, float, float]], dict]:
    bands, diagnostics = detected_activity_bands(original)
    override_count = None
    if five_lane_from_box is not None:
        override_count = 5 if box_number >= five_lane_from_box else 4
    detected_count = 5 if len(bands) >= 5 else 4 if len(bands) >= 4 else None
    lane_count = override_count or detected_count or 4
    selected_bands = select_lane_bands(bands, lane_count)

    if len(selected_bands) == lane_count:
        windows = windows_from_bands(selected_bands)
        window_source = "row_activity_bands"
    else:
        windows = template_windows_for_lane_count(lane_count)
        window_source = "template_fallback"

    return windows, {
        "method": "row_activity_template_v1",
        "lane_count": lane_count,
        "detected_lane_count": detected_count,
        "override": (
            {
                "type": "five_lane_from_box",
                "from_box": five_lane_from_box,
                "applied": override_count is not None,
                "lane_count": override_count,
            }
            if five_lane_from_box is not None
            else None
        ),
        "window_source": window_source,
        "diagnostics": diagnostics,
        "activity_bands": [
            {
                "start": round(band["start_ratio"], 4),
                "end": round(band["end_ratio"], 4),
                "center": round(band["center_ratio"], 4),
                "height": round(band["height_ratio"], 4),
                "score": round(band["score"], 4),
            }
            for band in bands
        ],
        "windows": [
            {
                "lane_number": index,
                "left": window[0],
                "top": window[1],
                "right": window[2],
                "bottom": window[3],
            }
            for index, window in enumerate(windows, start=1)
        ],
    }


def best_projection_span(
    values: list[float],
    minimum_ratio: float,
    peak_ratio: float,
    padding: int,
) -> tuple[int, int]:
    if not values:
        return 0, 0
    peak = max(values)
    threshold = max(minimum_ratio, peak * peak_ratio)
    best_start = 0
    best_end = len(values)
    best_score = -1.0
    start = None
    score = 0.0
    for index, value in enumerate(values):
        if value >= threshold:
            if start is None:
                start = index
                score = 0.0
            score += value
        elif start is not None:
            if score > best_score:
                best_start = start
                best_end = index
                best_score = score
            start = None
    if start is not None and score > best_score:
        best_start = start
        best_end = len(values)
    return max(0, best_start - padding), min(len(values), best_end + padding)


def strongest_subspan(
    values: list[float],
    start: int,
    end: int,
    target_height: int,
    top_bias: float = 0.0,
) -> tuple[int, int]:
    span = end - start
    if span <= target_height:
        return start, end

    window = max(1, target_height)
    local_values = values[start:end]
    current_score = sum(local_values[:window])
    peak_score = max(values) * window if values else current_score
    best_score = current_score
    best_start = 0
    max_offset = max(1, len(local_values) - window)
    for index in range(1, len(local_values) - window + 1):
        current_score += local_values[index + window - 1] - local_values[index - 1]
        adjusted_score = current_score - peak_score * top_bias * (index / max_offset)
        if adjusted_score > best_score:
            best_score = adjusted_score
            best_start = index
    return start + best_start, start + best_start + window


def padded_bbox(
    bbox: tuple[int, int, int, int] | None,
    crop_size: tuple[int, int],
    x_padding: int = 18,
    y_padding: int = 8,
) -> tuple[int, int, int, int]:
    width, height = crop_size
    if bbox is None:
        return 0, 0, width, height
    left, top, right, bottom = bbox
    return (
        max(0, left - x_padding),
        max(0, top - y_padding),
        min(width, right + x_padding),
        min(height, bottom + y_padding),
    )


def extract_lane(
    original: Image.Image,
    window: tuple[float, float, float, float],
    lane_number: int,
    top_bias: float,
) -> tuple[Image.Image, dict]:
    width, height = original.size
    left, top, right, bottom = window
    window_pixels = (
        int(width * left),
        int(height * top),
        int(width * right),
        int(height * bottom),
    )
    window_crop = original.crop(window_pixels)
    mask = rock_mask(window_crop)
    row_coverages = coverage_rows(mask)
    row_start, row_end = best_projection_span(
        row_coverages,
        minimum_ratio=0.055,
        peak_ratio=0.35,
        padding=8,
    )
    row_start, row_end = strongest_subspan(
        row_coverages,
        row_start,
        row_end,
        target_height=max(32, int(height * 0.085)),
        top_bias=top_bias,
    )
    lane_band_mask = mask.crop((0, row_start, mask.width, row_end))
    column_coverages = coverage_columns(lane_band_mask)
    column_start, column_end = best_projection_span(
        column_coverages,
        minimum_ratio=0.045,
        peak_ratio=0.18,
        padding=18,
    )
    if column_end - column_start < mask.width * 0.18:
        content_bbox = padded_bbox(
            lane_band_mask.getbbox(),
            lane_band_mask.size,
            x_padding=16,
            y_padding=0,
        )
    else:
        content_bbox = (
            max(0, column_start),
            0,
            min(mask.width, column_end),
            lane_band_mask.height,
        )
    content_bbox = (
        content_bbox[0],
        row_start,
        content_bbox[2],
        row_end,
    )
    crop = window_crop.crop(content_bbox).convert("RGBA")
    alpha = mask.crop(content_bbox)
    alpha = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(0.5))
    crop.putalpha(alpha)
    rotated = crop.rotate(90, expand=True)

    crop_pixels = (
        window_pixels[0] + content_bbox[0],
        window_pixels[1] + content_bbox[1],
        window_pixels[0] + content_bbox[2],
        window_pixels[1] + content_bbox[3],
    )
    return rotated, {
        "lane_number": lane_number,
        "search_window_relative": {
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
        },
        "search_window_pixels": {
            "left": window_pixels[0],
            "top": window_pixels[1],
            "right": window_pixels[2],
            "bottom": window_pixels[3],
        },
        "rock_crop_pixels": {
            "left": crop_pixels[0],
            "top": crop_pixels[1],
            "right": crop_pixels[2],
            "bottom": crop_pixels[3],
        },
        "output_width_px": rotated.width,
        "output_height_px": rotated.height,
        "rotation_degrees": 90,
        "trimmed_empty_tray_space": True,
    }


def composite_on_background(image: Image.Image, background: tuple[int, int, int]) -> Image.Image:
    canvas = Image.new("RGBA", image.size, (*background, 255))
    canvas.alpha_composite(image)
    return canvas.convert("RGB")


def resize_preview(image: Image.Image, target_height: int) -> Image.Image:
    if image.height <= target_height:
        return image.copy()
    return image.resize((image.width, target_height), Image.Resampling.LANCZOS)


def save_jpeg(image: Image.Image, target: Path, quality: int) -> dict:
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "JPEG", quality=quality, optimize=True, progressive=True)
    return {
        "width_px": image.width,
        "height_px": image.height,
        "size_bytes": target.stat().st_size,
        "mime_type": "image/jpeg",
        "quality": quality,
    }


def extract_rock_lane(
    source: Path,
    master_target: Path,
    preview_target: Path,
    box_number: int,
    five_lane_from_box: int | None,
) -> dict:
    original = ImageOps.exif_transpose(Image.open(source).convert("RGB"))
    lane_windows, lane_detection = resolve_lane_windows(
        original,
        box_number=box_number,
        five_lane_from_box=five_lane_from_box,
    )
    segments: list[Image.Image] = []
    lanes = []
    top_bias = 0.32 if lane_detection["window_source"] == "row_activity_bands" else 0.08
    lane_detection["row_selection_top_bias"] = top_bias
    for lane_number, window in enumerate(lane_windows, start=1):
        segment, lane = extract_lane(original, window, lane_number, top_bias=top_bias)
        segments.append(segment)
        lanes.append(lane)

    lane_width = max(segment.width for segment in segments)
    total_height = sum(segment.height for segment in segments)
    strip = Image.new("RGBA", (lane_width, total_height), (0, 0, 0, 0))
    y = 0
    for segment in segments:
        x = (lane_width - segment.width) // 2
        strip.alpha_composite(segment, (x, y))
        y += segment.height

    master = composite_on_background(strip, ROCK_LANE_BACKGROUND)
    preview = resize_preview(master, PREVIEW_HEIGHT_PX)
    master_asset = save_jpeg(master, master_target, MASTER_JPEG_QUALITY)
    preview_asset = save_jpeg(preview, preview_target, PREVIEW_JPEG_QUALITY)
    return {
        "strip_width_px": master.width,
        "strip_height_px": master.height,
        "lane_count": len(segments),
        "estimated_depth_span_m": len(segments),
        "lanes": lanes,
        "method": "cv_warm_rock_alpha_lane_v1",
        "lane_detection": lane_detection,
        "output_format": "jpeg_rgb",
        "background_rgb": ROCK_LANE_BACKGROUND,
        "master": {
            "image": str(master_target),
            **master_asset,
        },
        "preview": {
            "image": str(preview_target),
            **preview_asset,
        },
        "lossless": False,
        "resized": False,
        "preview_resized": preview.height != master.height,
        "requires_geologist_confirmation": lane_detection["window_source"] == "template_fallback",
    }


def selected_images(db, borehole: Borehole, box_number: int | None) -> list[CoreImage]:
    query = (
        select(CoreImage)
        .where(CoreImage.borehole_id == borehole.id)
        .order_by(CoreImage.box_number)
    )
    if box_number is not None:
        query = query.where(CoreImage.box_number == box_number)
    return list(db.scalars(query))


def depth_calibration_by_box(db, borehole: Borehole) -> dict[int, dict]:
    intervals = list(
        db.scalars(
            select(LithologyInterval)
            .where(LithologyInterval.borehole_id == borehole.id)
            .where(LithologyInterval.image_box.is_not(None))
            .order_by(LithologyInterval.image_box, LithologyInterval.from_depth)
        )
    )
    grouped: dict[int, list[LithologyInterval]] = {}
    for interval in intervals:
        if interval.image_box is None:
            continue
        grouped.setdefault(int(interval.image_box), []).append(interval)

    calibrations: dict[int, dict] = {}
    for box_number, box_intervals in grouped.items():
        from_depth = min(interval.from_depth for interval in box_intervals)
        to_depth = max(interval.to_depth for interval in box_intervals)
        calibrations[box_number] = {
            "method": "lithology_image_box_intervals_v1",
            "from_depth": round(from_depth, 3),
            "to_depth": round(to_depth, 3),
            "interval_count": len(box_intervals),
            "intervals": [
                {
                    "from_depth": round(interval.from_depth, 3),
                    "to_depth": round(interval.to_depth, 3),
                    "lithology_code": interval.lithology_code,
                    "lithology_label": interval.lithology_label,
                }
                for interval in box_intervals
            ],
        }
    return calibrations


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate single-lane rock-only core images for the image track."
    )
    parser.add_argument("--borehole", default="PBH-62")
    parser.add_argument("--box", type=int, default=None)
    parser.add_argument("--all", action="store_true")
    parser.add_argument(
        "--five-lane-from-box",
        type=int,
        default=None,
        help=(
            "Optional dataset geometry hint. Boxes from this number onward are prepared "
            "as five-lane trays even when row activity detection is uncertain."
        ),
    )
    args = parser.parse_args()
    if args.box is None and not args.all:
        raise SystemExit("Pass --box <number> for a sample or --all for the full borehole.")

    settings = get_settings()
    core_root = settings.repo_root / "MTSE-65(PBH 62)"
    db = SessionLocal()
    try:
        borehole = db.scalar(select(Borehole).where(Borehole.code == args.borehole))
        if borehole is None:
            raise RuntimeError(f"{args.borehole} is not seeded.")

        output_root = core_root / "core-rock-lanes" / borehole.code
        manifest_path = output_root / "manifest.json"
        manifest = {
            "borehole_code": borehole.code,
            "artifact_type": "core_rock_lanes",
            "method": "cv_warm_rock_alpha_lane_v1",
            "summary": (
                "Each corebox tray photograph is converted into one depth lane by detecting "
                "the tray row geometry, masking rock pixels, removing tray/ruler/background "
                "with transparency, rotating lane crops, and stacking them without resizing."
            ),
            "preparation_options": {
                "five_lane_from_box": args.five_lane_from_box,
            },
            "boxes": [],
        }

        generated = 0
        skipped = 0
        depth_calibrations = depth_calibration_by_box(db, borehole)
        for image in selected_images(db, borehole, None if args.all else args.box):
            source = source_image_path(core_root, image)
            if not source.exists() or source.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
                skipped += 1
                continue
            master_target = output_root / "master" / f"{image.box_number:03d}.jpg"
            preview_target = output_root / "preview" / f"{image.box_number:03d}.jpg"
            lane_metadata = extract_rock_lane(
                source,
                master_target,
                preview_target,
                box_number=image.box_number,
                five_lane_from_box=args.five_lane_from_box,
            )
            master_image = Path(lane_metadata["master"]["image"])
            preview_image = Path(lane_metadata["preview"]["image"])
            lane_metadata["master"]["image"] = str(master_image.relative_to(settings.repo_root))
            lane_metadata["preview"]["image"] = str(preview_image.relative_to(settings.repo_root))
            depth_calibration = depth_calibrations.get(image.box_number)
            calibrated_from_depth = (
                depth_calibration["from_depth"]
                if depth_calibration is not None
                else image.from_depth
            )
            calibrated_to_depth = (
                depth_calibration["to_depth"]
                if depth_calibration is not None
                else image.to_depth
            )
            lane_metadata["depth_calibration"] = depth_calibration
            lane_metadata["calibrated_from_depth"] = calibrated_from_depth
            lane_metadata["calibrated_to_depth"] = calibrated_to_depth
            manifest["boxes"].append(
                {
                    "box_number": image.box_number,
                    "from_depth": calibrated_from_depth,
                    "to_depth": calibrated_to_depth,
                    "source_core_image_from_depth": image.from_depth,
                    "source_core_image_to_depth": image.to_depth,
                    "source_image": str(source.relative_to(settings.repo_root)),
                    "strip_image": lane_metadata["master"]["image"],
                    "preview_image": lane_metadata["preview"]["image"],
                    **lane_metadata,
                }
            )
            generated += 1

        output_root.mkdir(parents=True, exist_ok=True)
        if manifest_path.exists() and not args.all:
            existing = json.loads(manifest_path.read_text(encoding="utf-8"))
            boxes_by_number = {
                int(box["box_number"]): box
                for box in existing.get("boxes", [])
                if box.get("box_number") is not None
            }
            for box in manifest["boxes"]:
                boxes_by_number[int(box["box_number"])] = box
            existing.update(
                {
                    "borehole_code": manifest["borehole_code"],
                    "artifact_type": manifest["artifact_type"],
                    "method": manifest["method"],
                    "summary": manifest["summary"],
                    "preparation_options": manifest["preparation_options"],
                    "boxes": [boxes_by_number[key] for key in sorted(boxes_by_number)],
                }
            )
            manifest = existing

        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"Generated {generated} rock lane image(s); skipped {skipped}.")
        print(f"Wrote {manifest_path}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
