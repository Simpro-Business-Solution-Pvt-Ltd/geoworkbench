import { describe, expect, it } from "vitest";

import type { LithologyInterval } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import { buildLithologyRenderModel, buildLithologyRenderModels } from "./lithologyRenderModel";

describe("lithologyRenderModel", () => {
  it("filters lithology intervals to the visible depth span", () => {
    const scale = createDepthScale(100, 240, 40, 10, 30, 0, 100);

    const models = buildLithologyRenderModels(
      [interval("before", 0, 8), interval("visible", 12, 14), interval("touching", 30, 31)],
      scale,
      { fromDepth: 10, toDepth: 30 },
    );

    expect(models.map((model) => model.key)).toEqual(["visible", "touching"]);
  });

  it("applies pattern class, fallback color, and title", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const model = buildLithologyRenderModel(interval("coal", 10, 12, "COAL"), scale);

    expect(model.className).toContain("pattern-coal");
    expect(model.style.backgroundColor).toBe("#111827");
    expect(model.title).toBe("10-12m COAL");
  });

  it("uses logged display color and corrected class when interval has correction metadata", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const model = buildLithologyRenderModel(
      {
        ...interval("edited", 10, 12, "SH"),
        display_color: "#abc123",
        attributes: { data_stage: "geologist_corrected" },
      },
      scale,
    );

    expect(model.style.backgroundColor).toBe("#abc123");
    expect(model.className).toContain("corrected-interval");
  });
});

function interval(id: string, fromDepth: number, toDepth: number, code = "SH"): LithologyInterval {
  return {
    id,
    source_row: null,
    from_depth: fromDepth,
    to_depth: toDepth,
    lithology_code: code,
    lithology_label: code,
    display_color: null,
    logged_color: null,
    seam_name: null,
    recovery: null,
    recovery_percent: null,
    rqd: null,
    structural_features: null,
    remark: null,
    image_box: null,
    image_file: null,
  };
}
