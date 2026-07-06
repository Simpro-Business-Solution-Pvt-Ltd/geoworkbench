import type { CoreImage } from "../../../api/types";
import type { DepthSpan } from "../../core/depthDomain";
import type { DepthScale } from "../../core/depthScale";

export type PreparedCoreImage = {
  image: CoreImage;
  fromDepth: number;
  toDepth: number;
  centerDepth: number;
};

export type CoreImageRenderMode = "overview" | "strip-preview" | "full-strip";
export type CoreImageAssetKind = "rock-lane" | "unprepared";

export type CoreImageRenderModel = {
  mode: CoreImageRenderMode;
  displayFromDepth: number;
  displayToDepth: number;
  visibleFromDepth: number;
  visibleToDepth: number;
  intervalHeight: number;
  imageOffsetPercent: number;
  imageScalePercent: number;
  imageClassName: string;
  assetKind: CoreImageAssetKind;
};

export const CORE_IMAGE_OVERSCAN_DEPTH = 12;
export const CORE_IMAGE_LOAD_OVERSCAN_DEPTH = 4;
export const CORE_IMAGE_LOAD_IDLE_MS = 180;
export const FULL_STRIP_FIT_HEIGHT = 24;
export const STRIP_IMAGE_LOAD_MIN_HEIGHT = 10;

export function prepareCoreImages(images: CoreImage[]): PreparedCoreImage[] {
  return images
    .map(prepareCoreImage)
    .filter((image): image is PreparedCoreImage => Boolean(image))
    .sort((a, b) => a.fromDepth - b.fromDepth || a.image.box_number - b.image.box_number);
}

export function visiblePreparedImages(
  images: PreparedCoreImage[],
  visibleDepthSpan: DepthSpan,
  overscanDepth = CORE_IMAGE_OVERSCAN_DEPTH,
) {
  return images.filter(
    (image) =>
      image.toDepth >= visibleDepthSpan.fromDepth - overscanDepth &&
      image.fromDepth <= visibleDepthSpan.toDepth + overscanDepth,
  );
}

export function resolveCoreImageRenderModel(
  image: PreparedCoreImage,
  scale: DepthScale,
): CoreImageRenderModel | null {
  const visibleFromDepth = Math.max(image.fromDepth, scale.fromDepth);
  const visibleToDepth = Math.min(image.toDepth, scale.toDepth);
  if (visibleToDepth <= visibleFromDepth) return null;

  const intervalHeight = Math.max(1, scale.depthToY(visibleToDepth) - scale.depthToY(visibleFromDepth));
  const intervalSpan = Math.max(0.001, image.toDepth - image.fromDepth);
  const visibleSpan = Math.max(0.001, visibleToDepth - visibleFromDepth);
  const imageOffsetPercent = ((visibleFromDepth - image.fromDepth) / intervalSpan) * 100;
  const imageScalePercent = (intervalSpan / visibleSpan) * 100;
  const mode = coreImageRenderMode(intervalHeight);
  const assetKind = coreImageAssetKind(image.image);

  return {
    mode,
    displayFromDepth: image.fromDepth,
    displayToDepth: image.toDepth,
    visibleFromDepth,
    visibleToDepth,
    intervalHeight,
    imageOffsetPercent: mode === "overview" ? imageOffsetPercent : 0,
    imageScalePercent: mode === "overview" ? imageScalePercent : 100,
    imageClassName:
      assetKind === "rock-lane"
        ? "core-strip-img core-strip-img-rock-lane"
        : mode === "full-strip"
          ? "core-strip-img core-strip-img-full"
          : "core-strip-img core-strip-img-crop",
    assetKind,
  };
}

export function canLoadCoreImage(model: CoreImageRenderModel, loadDepthSpan: DepthSpan) {
  if (model.mode === "overview") return false;
  return (
    model.visibleToDepth >= loadDepthSpan.fromDepth - CORE_IMAGE_LOAD_OVERSCAN_DEPTH &&
    model.visibleFromDepth <= loadDepthSpan.toDepth + CORE_IMAGE_LOAD_OVERSCAN_DEPTH
  );
}

export function imageAtDepth(images: PreparedCoreImage[], depth: number) {
  let low = 0;
  let high = images.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const image = images[mid];
    if (depth < image.fromDepth) {
      high = mid - 1;
    } else if (depth > image.toDepth) {
      low = mid + 1;
    } else {
      return image;
    }
  }
  return null;
}

export function nearestImage(images: PreparedCoreImage[], depth: number) {
  if (images.length === 0) return null;
  let nearest = images[0];
  let nearestDistance = Math.abs(nearest.centerDepth - depth);
  for (const image of images) {
    const distance = Math.abs(image.centerDepth - depth);
    if (distance < nearestDistance) {
      nearest = image;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export function stripDimension(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function stripLaneCount(metadata: Record<string, unknown> | null | undefined) {
  const value = stripDimension(metadata, "lane_count");
  if (typeof value !== "number") return 4;
  return Math.min(6, Math.max(1, Math.round(value)));
}

export function canShowPreparedCoreImage(image: CoreImage) {
  return Boolean(image.strip_url) && coreImageAssetKind(image) === "rock-lane";
}

export function coreImageDisplayUrl(image: CoreImage, mode: CoreImageRenderMode) {
  if (!canShowPreparedCoreImage(image)) return null;
  if (mode === "strip-preview") return image.strip_preview_url || image.strip_url;
  if (mode === "full-strip") return image.strip_url;
  return null;
}

export function coreImageAssetKind(image: CoreImage): CoreImageAssetKind {
  const method = image.strip_metadata?.method;
  const outputFormat = image.strip_metadata?.output_format;
  const stripImage = image.strip_metadata?.strip_image;
  if (
    method === "cv_warm_rock_alpha_lane_v1" ||
    outputFormat === "jpeg_rgb" ||
    outputFormat === "png_rgba" ||
    (typeof stripImage === "string" && stripImage.includes("core-rock-lanes"))
  ) {
    return "rock-lane";
  }
  return "unprepared";
}

function prepareCoreImage(image: CoreImage): PreparedCoreImage | null {
  const calibratedFromDepth = numericMetadataValue(image.strip_metadata, "calibrated_from_depth");
  const calibratedToDepth = numericMetadataValue(image.strip_metadata, "calibrated_to_depth");
  const fromDepth = calibratedFromDepth ?? image.from_depth ?? image.to_depth;
  const toDepth = calibratedToDepth ?? image.to_depth ?? image.from_depth;
  if (typeof fromDepth !== "number" || typeof toDepth !== "number") return null;
  if (!Number.isFinite(fromDepth) || !Number.isFinite(toDepth)) return null;
  const startDepth = Math.min(fromDepth, toDepth);
  const endDepth = Math.max(fromDepth, toDepth);
  return {
    image,
    fromDepth: startDepth,
    toDepth: endDepth > startDepth ? endDepth : startDepth + 0.01,
    centerDepth: (startDepth + endDepth) / 2,
  };
}

function numericMetadataValue(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coreImageRenderMode(intervalHeight: number): CoreImageRenderMode {
  if (intervalHeight >= FULL_STRIP_FIT_HEIGHT) return "full-strip";
  if (intervalHeight >= STRIP_IMAGE_LOAD_MIN_HEIGHT) return "strip-preview";
  return "overview";
}
