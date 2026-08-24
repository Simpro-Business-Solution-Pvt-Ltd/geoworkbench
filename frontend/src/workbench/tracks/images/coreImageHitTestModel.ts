import type { TrackObject } from "../../core/trackObject";
import { imageAtDepth, nearestImage, type PreparedCoreImage } from "./coreImageRenderModel";

export type CoreImageTrackObject = Extract<TrackObject, { kind: "core-image" }>;

export function buildCoreImageHit(images: PreparedCoreImage[], depth: number): CoreImageTrackObject | null {
  const preparedImage = imageAtDepth(images, depth) ?? nearestImage(images, depth);
  if (!preparedImage) return null;

  return {
    kind: "core-image",
    id: `core-image:${preparedImage.image.box_number}`,
    depth,
    image: preparedImage.image,
  };
}
