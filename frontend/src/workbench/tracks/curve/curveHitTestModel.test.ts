import { describe, expect, it } from "vitest";

import type { Curve } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import type { TrackObject } from "../../core/trackObject";
import { buildCurveSampleHit, curveHitBelongsToTrack } from "./curveHitTestModel";
import type { CurveDisplayConfig, CurveRenderInput } from "./curveRenderModel";

describe("curveHitTestModel", () => {
  it("returns the nearest curve sample and related samples at the pointer depth", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);
    const hit = buildCurveSampleHit(
      [
        input("gamma", "Gamma", "API", "#ef4444", [
          { depth: 10, value: 50 },
          { depth: 30, value: 70 },
        ]),
        input("resistivity", "Resistivity", "ohm.m", "#2563eb", [
          { depth: 20, value: 25 },
          { depth: 40, value: 75 },
        ]),
      ],
      scale,
      12,
    );

    expect(hit?.kind).toBe("curve-sample");
    expect(hit?.curve.key).toBe("gamma");
    expect(hit?.depth).toBe(10);
    expect(hit?.distance).toBe(2);
    expect(hit?.screenXPercent).toBe(50);
    expect(hit?.screenYPercent).toBe(scale.depthToContentPercent(10));
    expect(hit?.relatedSamples?.map((sample) => sample.curve.key)).toEqual(["gamma", "resistivity"]);
    expect(hit?.relatedSamples?.map((sample) => sample.distance)).toEqual([2, 8]);
  });

  it("returns null when no configured curves have samples", () => {
    const scale = createDepthScale(100, 240, 40);

    expect(buildCurveSampleHit([input("gamma", "Gamma", "API", "#ef4444", [])], scale, 20)).toBeNull();
  });

  it("identifies whether a hovered curve sample belongs to the rendered track", () => {
    const curves = [input("gamma", "Gamma", "API", "#ef4444", [{ depth: 10, value: 50 }])];
    const hit = buildCurveSampleHit(curves, createDepthScale(100, 240, 40), 10);
    const other: TrackObject = {
      kind: "curve-sample",
      id: "density:10",
      depth: 10,
      curve: curve("density", "Density", "g/cc", "#22c55e", [{ depth: 10, value: 2.1 }]),
      sample: { depth: 10, value: 2.1 },
      distance: 0,
      screenXPercent: 50,
      screenYPercent: 10,
    };

    expect(curveHitBelongsToTrack(hit, curves)).toBe(true);
    expect(curveHitBelongsToTrack(other, curves)).toBe(false);
    expect(curveHitBelongsToTrack({ kind: "empty", id: "empty:10", depth: 10 }, curves)).toBe(false);
  });
});

function input(
  key: string,
  label: string,
  unit: string,
  color: string,
  samples: Curve["samples"],
): CurveRenderInput {
  return {
    config: config(key, label, unit, color),
    curve: curve(key, label, unit, color, samples),
  };
}

function config(key: string, label: string, unit: string, color: string): CurveDisplayConfig {
  return {
    curveKey: key,
    label,
    unit,
    color,
    visible: true,
    scale: { mode: "manual", min: 0, max: 100 },
  };
}

function curve(key: string, label: string, unit: string, color: string, samples: Curve["samples"]): Curve {
  return {
    id: key.length,
    key,
    label,
    unit,
    source_type: "las",
    color,
    samples,
  };
}
