import { describe, expect, it } from "vitest";

import type { Curve } from "../../api/types";
import { nearestSample, normalizedX, samplesForVisibleCurve } from "./curveMath";

describe("curveMath", () => {
  it("finds the nearest sample by depth", () => {
    const result = nearestSample(curve(), 12);

    expect(result?.sample).toEqual({ depth: 10, value: 45 });
    expect(result?.distance).toBe(2);
  });

  it("normalizes curve x positions into a clamped percent range", () => {
    expect(normalizedX(50, 0, 100)).toBe(50);
    expect(normalizedX(-10, 0, 100)).toBe(0);
    expect(normalizedX(120, 0, 100)).toBe(100);
    expect(normalizedX(10, 10, 10)).toBe(50);
  });

  it("keeps outside and interpolated edge samples for curve continuity", () => {
    expect(samplesForVisibleCurve(curve().samples, 12, 28)).toEqual([
      { depth: 10, value: 45 },
      { depth: 12, value: 48 },
      { depth: 20, value: 60 },
      { depth: 28, value: 68 },
      { depth: 30, value: 70 },
    ]);
  });

  it("interpolates visible edges even when no sample exists inside the visible window", () => {
    expect(samplesForVisibleCurve(curve().samples, 12, 18)).toEqual([
      { depth: 10, value: 45 },
      { depth: 12, value: 48 },
      { depth: 18, value: 57 },
      { depth: 20, value: 60 },
    ]);
  });
});

function curve(): Curve {
  return {
    id: 1,
    key: "gamma",
    label: "Gamma",
    unit: "API",
    source_type: "las",
    color: "#aa6633",
    samples: [
      { depth: 0, value: 30 },
      { depth: 10, value: 45 },
      { depth: 20, value: 60 },
      { depth: 30, value: 70 },
    ],
  };
}
