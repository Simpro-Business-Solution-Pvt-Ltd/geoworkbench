import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildCurveMetrics } from "./curveMetrics";

describe("buildCurveMetrics", () => {
  it("reports empty curve coverage without failing", () => {
    const metrics = new Map(buildCurveMetrics(workbenchWithCurves([]), DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("curve_count")?.value).toBe("0");
    expect(metrics.get("curve_depth_from")?.value).toBe("-");
    expect(metrics.get("curve_depth_to")?.value).toBe("-");
    expect(metrics.get("curve_coverage_percent")?.value).toBe("-");
  });

  it("derives coverage and min/max values for all curve samples", () => {
    const metrics = new Map(
      buildCurveMetrics(
        workbenchWithCurves([
          {
            id: 1,
            key: "gamma",
            label: "Natural Gamma",
            unit: "API",
            source_type: "las",
            color: "#ef4444",
            samples: [
              { depth: 10, value: 20 },
              { depth: 60, value: 80 },
            ],
          },
        ]),
        DEFAULT_USER_PREFERENCES,
      ).map((metric) => [metric.key, metric]),
    );

    expect(metrics.get("curve_depth_from")?.value).toBe("10 m");
    expect(metrics.get("curve_depth_to")?.value).toBe("60 m");
    expect(metrics.get("curve_coverage_percent")?.value).toBe("50 %");
    expect(metrics.get("curve_gamma_min")?.value).toBe("20 API");
    expect(metrics.get("curve_gamma_max")?.value).toBe("80 API");
  });
});

function workbenchWithCurves(curves: BoreholeWorkbench["curves"]): BoreholeWorkbench {
  return {
    id: 1,
    code: "TEST",
    title: "Test",
    state: null,
    total_depth: 100,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "draft",
    attributes: null,
    layout: null,
    lithology_intervals: [],
    seam_intervals: [],
    core_images: [],
    curves,
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
