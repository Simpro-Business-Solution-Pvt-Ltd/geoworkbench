import { describe, expect, it } from "vitest";

import { createDepthScale } from "../../core/depthScale";
import { buildDepthTickRenderModels } from "./depthRenderModel";

describe("depthRenderModel", () => {
  it("builds positioned tick render models for the visible depth span", () => {
    const scale = createDepthScale(100, 240, 40, 10, 30, 0, 100);

    const ticks = buildDepthTickRenderModels(scale, { targetPixelSpacing: 42 });

    expect(ticks.length).toBeGreaterThan(1);
    expect(ticks[0]).toMatchObject({
      className: expect.stringContaining("depth-mark"),
      style: { top: expect.stringContaining("px") },
    });
    expect(ticks.every((tick) => tick.depth >= 10 && tick.depth <= 30)).toBe(true);
  });

  it("uses smaller tick spacing to generate more ticks", () => {
    const scale = createDepthScale(100, 1040, 40, 0, 100, 0, 100);

    const coarse = buildDepthTickRenderModels(scale, { targetPixelSpacing: 80 });
    const dense = buildDepthTickRenderModels(scale, { targetPixelSpacing: 20 });

    expect(dense.length).toBeGreaterThan(coarse.length);
  });
});
