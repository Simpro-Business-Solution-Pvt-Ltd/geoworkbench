import { describe, expect, it } from "vitest";

import type { CoreImage } from "../../../api/types";
import { buildCoreImageHit } from "./coreImageHitTestModel";
import { prepareCoreImages } from "./coreImageRenderModel";

describe("coreImageHitTestModel", () => {
  it("returns the image covering the pointer depth", () => {
    const images = prepareCoreImages([coreImage(1, 0, 4), coreImage(2, 4, 8)]);
    const hit = buildCoreImageHit(images, 5.25);

    expect(hit?.kind).toBe("core-image");
    expect(hit?.image.box_number).toBe(2);
    expect(hit?.depth).toBe(5.25);
  });

  it("falls back to the nearest image when the pointer depth is outside image intervals", () => {
    const images = prepareCoreImages([coreImage(1, 0, 4), coreImage(2, 20, 24)]);
    const hit = buildCoreImageHit(images, 14);

    expect(hit?.image.box_number).toBe(2);
  });

  it("returns null when no prepared images are available", () => {
    expect(buildCoreImageHit([], 10)).toBeNull();
  });
});

function coreImage(boxNumber: number, fromDepth: number, toDepth: number): CoreImage {
  return {
    box_number: boxNumber,
    name: `Box ${boxNumber}`,
    file_path: `box-${boxNumber}.jpg`,
    from_depth: fromDepth,
    to_depth: toDepth,
    url: `/box-${boxNumber}.jpg`,
    original_url: `/box-${boxNumber}.jpg`,
    strip_url: `/box-${boxNumber}-strip.jpg`,
    strip_metadata: {
      strip_width_px: 100,
      strip_height_px: 400,
    },
    image_metadata: null,
  };
}
