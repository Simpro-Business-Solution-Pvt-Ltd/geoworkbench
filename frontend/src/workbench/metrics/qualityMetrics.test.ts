import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildQualityMetrics } from "./qualityMetrics";

describe("buildQualityMetrics", () => {
  it("counts validation issues and AI suggestions", () => {
    const metrics = new Map(buildQualityMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("validation_issue_count")?.value).toBe("2");
    expect(metrics.get("validation_issue_count")?.source).toBe("rules");
    expect(metrics.get("ai_suggestion_count")?.value).toBe("1");
    expect(metrics.get("ai_suggestion_count")?.category).toBe("ai");
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
    validation_issues: [
      {
        id: 1,
        code: "GAP",
        severity: "warning",
        message: "Gap",
        from_depth: 10,
        to_depth: 11,
        entity_type: "interval",
        entity_id: "1",
        status: "open",
        issue_metadata: null,
      },
      {
        id: 2,
        code: "OVERLAP",
        severity: "error",
        message: "Overlap",
        from_depth: 12,
        to_depth: 13,
        entity_type: "interval",
        entity_id: "2",
        status: "open",
        issue_metadata: null,
      },
    ],
    ai_suggestions: [
      {
        id: 1,
        validation_issue_id: 1,
        suggestion_type: "correction",
        title: "Review gap",
        rationale: "Depth continuity check",
        recommended_action: "Inspect interval",
        confidence: 0.8,
        status: "open",
        provider: "local",
        from_depth: 10,
        to_depth: 11,
        entity_type: "interval",
        entity_id: "1",
        patch: null,
        evidence: null,
      },
    ],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
