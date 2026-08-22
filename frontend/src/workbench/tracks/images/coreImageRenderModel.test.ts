import { describe, expect, it } from "vitest";

import type { CoreImage } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import {
  canLoadCoreImage,
  prepareCoreImages,
  resolveCoreImageRenderModel,
  visiblePreparedImages,
} from "./coreImageRenderModel";

describe("coreImageRenderModel", () => {
  it("filters prepared images by visible depth with overscan", () => {
    const images = prepareCoreImages([
      coreImage(1, 0, 4),
      coreImage(2, 20, 24),
      coreImage(3, 40, 44),
    ]);

    expect(visiblePreparedImages(images, { fromDepth: 10, toDepth: 12 }, 8).map((item) => item.image.box_number)).toEqual([
      1,
      2,
    ]);
  });

  it("uses load overscan for non-overview image loading", () => {
    const [image] = prepareCoreImages([coreImage(1, 20, 24)]);
    const scale = createDepthScale(100, 800, 40, 20, 24, 0, 100);
    const model = resolveCoreImageRenderModel(image, scale);

    expect(model).not.toBeNull();
    expect(model && canLoadCoreImage(model, { fromDepth: 16, toDepth: 18 })).toBe(true);
    expect(model && canLoadCoreImage(model, { fromDepth: 10, toDepth: 12 })).toBe(false);
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
