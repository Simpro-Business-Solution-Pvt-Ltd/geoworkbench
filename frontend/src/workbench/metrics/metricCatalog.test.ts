import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildRegisteredMetrics } from "./metricBuilderRegistry";
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

  it("only exposes configurable KPI metrics that are produced by registered builders", () => {
    const producedMetricKeys = new Set(buildRegisteredMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES).map((metric) => metric.key));

    expect(SINGLE_VALUE_METRICS.map((metric) => metric.value).filter((key) => !producedMetricKeys.has(key))).toEqual([]);
  });
});

function sampleWorkbench(): BoreholeWorkbench {
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
    curves: [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
