import { describe, expect, it } from "vitest";

import type { DisplayTrack, LithologyInterval } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import {
  buildQuantitativeBarRenderModel,
  buildQuantitativeBarRenderModels,
  valueForInterval,
} from "./quantitativeBarRenderModel";

describe("quantitativeBarRenderModel", () => {
  it("reads configured numeric value from lithology intervals", () => {
    expect(valueForInterval(track({ valueField: "rqd", valueMultiplier: 100 }), interval("a", 10, 12, { rqd: 0.42 }))).toBe(42);
    expect(valueForInterval(track({ valueField: "rqd" }), interval("a", 10, 12))).toBeNull();
  });

  it("builds row and bar styles with clamped width", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const model = buildQuantitativeBarRenderModel(
      interval("a", 10, 12, { recovery_percent: 125 }),
      track({ valueField: "recovery_percent", min: 0, max: 100, color: "#123456" }),
      scale,
    );

    expect(model?.barStyle).toMatchObject({ width: "100%", background: "#123456" });
    expect(model?.rowStyle).toMatchObject({ top: "20px", height: "4px" });
    expect(model?.title).toBe("Recovery: 125.0%");
  });

  it("filters visible intervals and skips missing values", () => {
    const scale = createDepthScale(100, 240, 40, 10, 30, 0, 100);

    const models = buildQuantitativeBarRenderModels(
      [
        interval("before", 0, 8, { recovery_percent: 10 }),
        interval("visible", 12, 14, { recovery_percent: 50 }),
        interval("missing", 16, 18),
      ],
      track({ valueField: "recovery_percent" }),
      scale,
      { fromDepth: 10, toDepth: 30 },
    );

    expect(models.map((model) => model.interval.id)).toEqual(["visible"]);
  });
});

function track(overrides: Partial<DisplayTrack> = {}): DisplayTrack {
  return {
    id: "rqd-track",
    type: "quantitativeBar",
    title: "Recovery",
    visible: true,
    width: 90,
    unit: "%",
    min: 0,
    max: 100,
    ...overrides,
  };
}

function interval(
  id: string,
  fromDepth: number,
  toDepth: number,
  overrides: Partial<LithologyInterval> = {},
): LithologyInterval {
  return {
    id,
    source_row: null,
    from_depth: fromDepth,
    to_depth: toDepth,
    lithology_code: "COAL",
    lithology_label: "Coal",
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
    ...overrides,
  };
}
