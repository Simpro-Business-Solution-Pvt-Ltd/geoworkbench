import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildIntervalMetrics } from "./intervalMetrics";

describe("buildIntervalMetrics", () => {
  it("derives seam, recovery, and RQD summaries", () => {
    const metrics = new Map(buildIntervalMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("interval_count")?.value).toBe("2");
    expect(metrics.get("seam_count")?.value).toBe("1");
    expect(metrics.get("seam_thickness")?.value).toBe("3 m");
    expect(metrics.get("avg_recovery")?.value).toBe("85 %");
    expect(metrics.get("avg_rqd")?.value).toBe("50 %");
  });

  it("reports missing recovery/RQD as empty values", () => {
    const data = sampleWorkbench();
    data.lithology_intervals = [];
    const metrics = new Map(buildIntervalMetrics(data, DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("avg_recovery")?.value).toBe("-");
    expect(metrics.get("avg_rqd")?.value).toBe("-");
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
    lithology_intervals: [
      {
        id: "1",
        from_depth: 0,
        to_depth: 5,
        lithology_code: "SH",
        lithology_label: "Shale",
        display_color: null,
        logged_color: null,
        seam_name: null,
        recovery: null,
        recovery_percent: 80,
        rqd: 0.4,
        structural_features: null,
        remark: null,
        source_row: null,
        image_box: null,
        image_file: null,
      },
      {
        id: "2",
        from_depth: 5,
        to_depth: 8,
        lithology_code: "COAL",
        lithology_label: "Coal",
        display_color: null,
        logged_color: null,
        seam_name: "A",
        recovery: null,
        recovery_percent: 90,
        rqd: 0.6,
        structural_features: null,
        remark: null,
        source_row: null,
        image_box: null,
        image_file: null,
      },
    ],
    seam_intervals: [
      {
        id: "A",
        name: "A",
        from_depth: 5,
        to_depth: 8,
        thickness: 3,
        lithology_code: "COAL",
        lithology_label: "Coal",
        image_box: null,
      },
    ],
    core_images: [],
    curves: [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
