import { describe, expect, it } from "vitest";

import { createValueScale, valueToPercent } from "./valueScale";

describe("valueScale", () => {
  it("maps values to percent and back through the configured numeric domain", () => {
    const scale = createValueScale({ min: 20, max: 80 });

    expect(scale.toPercent(20)).toBe(0);
    expect(scale.toPercent(50)).toBeCloseTo(50, 6);
    expect(scale.toPercent(80)).toBe(100);
    expect(scale.toValue(50)).toBeCloseTo(50, 6);
  });

  it("clamps out-of-range values and protects invalid domains", () => {
    expect(valueToPercent(120, 20, 80)).toBe(100);
    expect(valueToPercent(-10, 20, 80)).toBe(0);
    expect(createValueScale({ min: 5, max: 5 }).toPercent(5.5)).toBe(50);
    expect(createValueScale({ min: Number.NaN, max: Number.NaN }).toPercent(Number.NaN)).toBe(50);
  });
});
