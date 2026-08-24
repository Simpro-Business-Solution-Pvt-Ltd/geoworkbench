import { describe, expect, it } from "vitest";

import type { SeamInterval } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import { buildSeamRenderModel, buildSeamRenderModels } from "./seamRenderModel";

describe("seamRenderModel", () => {
  it("filters seams to the visible depth span", () => {
    const scale = createDepthScale(100, 240, 40, 10, 30, 0, 100);

    const models = buildSeamRenderModels(
      [seam("before", 0, 8), seam("visible", 12, 14), seam("touching", 30, 32)],
      scale,
      { fromDepth: 10, toDepth: 30 },
      { labelMinHeightPx: 8, labelMaxVisibleSpanM: 50 },
    );

    expect(models.map((model) => model.seam.id)).toEqual(["visible", "touching"]);
  });

  it("computes pixel height and label visibility", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const small = buildSeamRenderModel(seam("thin", 10, 11), scale, {
      labelMinHeightPx: 8,
      labelMaxVisibleSpanM: 120,
    });
    const large = buildSeamRenderModel(seam("thick", 10, 20), scale, {
      labelMinHeightPx: 8,
      labelMaxVisibleSpanM: 120,
    });

    expect(small.pixelHeight).toBeCloseTo(2, 4);
    expect(small.showLabel).toBe(false);
    expect(large.showLabel).toBe(true);
    expect(large.style).toMatchObject({ minHeight: "4px" });
    expect(large.title).toBe("Seam thick: 10-20m");
  });

  it("hides labels when the visible depth span is too broad", () => {
    const scale = createDepthScale(600, 640, 40, 0, 600, 0, 600);

    const model = buildSeamRenderModel(seam("thick", 100, 150), scale, {
      labelMinHeightPx: 8,
      labelMaxVisibleSpanM: 160,
    });

    expect(model.pixelHeight).toBeGreaterThan(8);
    expect(model.showLabel).toBe(false);
  });
});

function seam(id: string, fromDepth: number, toDepth: number): SeamInterval {
  return {
    id,
    name: `Seam ${id}`,
    from_depth: fromDepth,
    to_depth: toDepth,
    thickness: toDepth - fromDepth,
    lithology_code: "COAL",
    lithology_label: "Coal",
    image_box: null,
  };
}
