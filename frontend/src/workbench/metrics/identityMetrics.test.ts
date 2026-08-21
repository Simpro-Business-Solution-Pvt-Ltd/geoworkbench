import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildIdentityMetrics } from "./identityMetrics";

describe("buildIdentityMetrics", () => {
  it("formats total depth with the active depth unit", () => {
    const metric = buildIdentityMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES)[0];
    const imperialMetric = buildIdentityMetrics(sampleWorkbench(), {
      ...DEFAULT_USER_PREFERENCES,
      depthUnit: "ft",
      numberFormat: "en-US",
    })[0];

    expect(metric.value).toBe("125.5 m");
    expect(imperialMetric.value).toBe("411.75 ft");
  });
});

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "TEST",
    title: "Test",
    state: null,
    total_depth: 125.5,
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
