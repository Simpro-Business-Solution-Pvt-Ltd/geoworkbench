import { describe, expect, it } from "vitest";

import { metricLabel, SINGLE_VALUE_METRICS } from "./metricCatalog";

describe("metricCatalog", () => {
  it("contains curve coverage metrics for configurable KPI widgets", () => {
    expect(SINGLE_VALUE_METRICS.map((metric) => metric.value)).toEqual(
      expect.arrayContaining(["curve_depth_from", "curve_depth_to", "curve_coverage_percent"]),
    );
  });

  it("returns human labels with a safe fallback", () => {
    expect(metricLabel("curve_coverage_percent")).toBe("Curve coverage %");
    expect(metricLabel("future_metric")).toBe("future_metric");
  });
});
