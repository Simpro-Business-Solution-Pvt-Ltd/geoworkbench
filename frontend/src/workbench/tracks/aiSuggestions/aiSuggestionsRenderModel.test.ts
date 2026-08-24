import { describe, expect, it } from "vitest";

import type { AiSuggestion, BoreholeWorkbench } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import {
  buildAiSuggestionGroupRenderModels,
  confidenceLabel,
  findAiSuggestionGroupAtY,
  suggestionDepth,
} from "./aiSuggestionsRenderModel";

describe("aiSuggestionsRenderModel", () => {
  it("orders renderable suggestions by status and depth", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const groups = buildAiSuggestionGroupRenderModels(
      workbench([
        suggestion(1, "accepted", 20),
        suggestion(2, "open", 30),
        suggestion(3, "rejected", 10),
        suggestion(4, "draft", 5),
      ]),
      scale,
      { fromDepth: 0, toDepth: 100 },
      { bucketPixels: 0 },
    );

    expect(groups.map((group) => group.suggestions[0].id)).toEqual([2, 1, 3]);
  });

  it("groups nearby suggestions by rendered pixel distance", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const groups = buildAiSuggestionGroupRenderModels(
      workbench([suggestion(1, "open", 10), suggestion(2, "open", 12)]),
      scale,
      { fromDepth: 0, toDepth: 100 },
      { bucketPixels: 6 },
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("2 AI items near 10.0m");
    expect(groups[0].className).toBe("open validation_issue");
  });

  it("filters depth-backed suggestions to the visible span but keeps no-depth items", () => {
    const scale = createDepthScale(100, 240, 40, 40, 60, 0, 100);

    const groups = buildAiSuggestionGroupRenderModels(
      workbench([suggestion(1, "open", 10), suggestion(2, "open", null)]),
      scale,
      { fromDepth: 40, toDepth: 60 },
      { bucketPixels: 0 },
    );

    expect(groups.map((group) => group.suggestions[0].id)).toEqual([2]);
  });

  it("finds rendered groups by y hit window", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);
    const groups = buildAiSuggestionGroupRenderModels(
      workbench([suggestion(1, "open", 10)]),
      scale,
      { fromDepth: 0, toDepth: 100 },
      { bucketPixels: 0 },
    );

    expect(findAiSuggestionGroupAtY(groups, groups[0].y + 10, { hitTopPaddingPx: 2, hitHeightPx: 28 })?.id).toBe("ai:1");
    expect(findAiSuggestionGroupAtY(groups, groups[0].y + 40, { hitTopPaddingPx: 2, hitHeightPx: 28 })).toBeNull();
  });

  it("formats confidence and synthetic depth", () => {
    expect(confidenceLabel(0.764)).toBe("76%");
    expect(confidenceLabel(null)).toBe("");
    expect(suggestionDepth(suggestion(1, "open", null), 2, 2)).toBe(2);
  });
});

function suggestion(id: number, status: string, depth: number | null): AiSuggestion {
  return {
    id,
    validation_issue_id: null,
    suggestion_type: "validation_issue",
    title: `Suggestion ${id}`,
    rationale: "Check interval",
    recommended_action: "Review",
    confidence: 0.76,
    status,
    provider: "rule_based",
    from_depth: depth,
    to_depth: depth === null ? null : depth + 1,
    entity_type: null,
    entity_id: null,
    patch: null,
    evidence: null,
  };
}

function workbench(ai_suggestions: AiSuggestion[]): BoreholeWorkbench {
  return {
    id: 1,
    code: "BH-01",
    title: "BH-01",
    state: null,
    total_depth: 100,
    closure_note: null,
    source_workbook: null,
    source_sheet: null,
    workflow_status: "draft",
    attributes: null,
    lithology_intervals: [],
    seam_intervals: [],
    curves: [],
    core_images: [],
    layout: null,
    display_layouts: [],
    validation_issues: [],
    ai_suggestions,
    source_imports: [],
    field_submissions: [],
    source_files: [],
    correction_audits: [],
  };
}
