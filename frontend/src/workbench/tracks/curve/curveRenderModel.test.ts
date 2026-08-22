import { describe, expect, it } from "vitest";

import type { Curve, DisplayTrack } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import { buildCurveRenderModel, strokeDasharray, type CurveDisplayConfig } from "./curveRenderModel";

describe("curveRenderModel", () => {
  it("builds polyline points with outside and interpolated visible edge samples", () => {
    const scale = createDepthScale(40, 440, 40, 12, 28, 0, 40);
    const model = buildCurveRenderModel(config(), curve(), scale, { minYPixelSpacing: 0 });

    expect(model.points.map((point) => point.depth)).toEqual([10, 12, 20, 28, 30]);
    expect(model.points.map((point) => point.value)).toEqual([45, 48, 60, 68, 70]);
    expect(model.polylinePoints).toContain(",");
  });

  it("decimates dense points by rendered pixel spacing while retaining bounds", () => {
    const scale = createDepthScale(100, 140, 40, 10, 20, 0, 100);
    const denseCurve = {
      ...curve(),
      samples: Array.from({ length: 101 }, (_, depth) => ({ depth, value: depth })),
    };
    const model = buildCurveRenderModel(config(), denseCurve, scale, { minYPixelSpacing: 8 });

    expect(model.points.length).toBeLessThan(20);
    expect(model.points[0].depth).toBeLessThan(10);
    expect(model.points.at(-1)?.depth).toBeGreaterThan(20);
  });

  it("maps line styles to SVG dash arrays", () => {
    expect(strokeDasharray("solid")).toBeUndefined();
    expect(strokeDasharray("dashed")).toBe("4 3");
    expect(strokeDasharray("dotted")).toBe("1 3");
  });
});

function config(): CurveDisplayConfig {
  return {
    curveKey: "gamma",
    label: "Gamma",
    unit: "API",
    color: "#ef4444",
    visible: true,
    scale: { mode: "manual", min: 0, max: 100 },
  };
}

function curve(): Curve {
  return {
    id: 1,
    key: "gamma",
    label: "Gamma",
    unit: "API",
    source_type: "las",
    color: "#ef4444",
    samples: [
      { depth: 0, value: 30 },
      { depth: 10, value: 45 },
      { depth: 20, value: 60 },
      { depth: 30, value: 70 },
    ],
  };
}
