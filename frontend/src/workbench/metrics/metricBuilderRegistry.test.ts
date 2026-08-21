import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { BOREHOLE_METRIC_BUILDERS, buildRegisteredMetrics } from "./metricBuilderRegistry";

describe("metricBuilderRegistry", () => {
  it("registers the expected metric builder families in deterministic order", () => {
    const metrics = buildRegisteredMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES);

    expect(BOREHOLE_METRIC_BUILDERS).toHaveLength(5);
    expect(metrics.slice(0, 6).map((metric) => metric.key)).toEqual([
      "total_depth",
      "interval_count",
      "corebox_count",
      "seam_count",
      "seam_thickness",
      "avg_recovery",
    ]);
    expect(metrics.map((metric) => metric.key)).toContain("validation_issue_count");
    expect(metrics.map((metric) => metric.key)).toContain("ai_suggestion_count");
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
