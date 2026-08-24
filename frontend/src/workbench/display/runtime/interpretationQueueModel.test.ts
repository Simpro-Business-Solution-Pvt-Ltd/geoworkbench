import { describe, expect, it } from "vitest";

import type { AiSuggestion, BoreholeWorkbench, Curve, LithologyInterval, SeamInterval, ValidationIssue } from "../../../api/types";
import { buildInterpretationQueue } from "./interpretationQueueModel";

describe("interpretationQueueModel", () => {
  it("prioritizes validation errors and open AI suggestions with depth evidence", () => {
    const queue = buildInterpretationQueue(
      borehole({
        validation_issues: [issue(10, "error", "DEPTH_GAP", "Gap detected")],
        ai_suggestions: [suggestion(7, 12.5, 0.82)],
        curves: [curve("ngamma", 0, 100)],
        seams: [seam("A", 40, 42)],
        coreImages: 1,
        collar: { coalgrid_easting: 1000, coalgrid_northing: 2000 },
      }),
    );

    expect(queue[0]).toMatchObject({
      id: "validation:10",
      priority: "critical",
      source: "validation",
      depth: 10,
    });
    expect(queue.map((item) => item.id)).toContain("ai:7");
    expect(queue.find((item) => item.id === "ai:7")?.evidence).toContain("12.50m");
  });

  it("adds data evidence gaps for curves, core images, seams, and coordinates", () => {
    const queue = buildInterpretationQueue(borehole({ intervals: [interval(0, 10)] }));

    expect(queue.map((item) => item.id)).toEqual([
      "curves:missing",
      "seams:missing",
      "core-images:missing",
      "metadata:coordinates",
    ]);
  });

  it("returns a ready item when no action is blocking review", () => {
    const queue = buildInterpretationQueue(
      borehole({
        intervals: [interval(0, 10)],
        curves: [curve("ngamma", 0, 120)],
        seams: [seam("A", 40, 42)],
        coreImages: 1,
        collar: { coalgrid_easting: 1000, coalgrid_northing: 2000 },
      }),
    );

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ id: "workflow:ready", priority: "ready" });
  });

  it("adds correction progress when intervals carry raw stage metadata", () => {
    const queue = buildInterpretationQueue(
      borehole({
        intervals: [interval(0, 10, "raw_imported"), interval(10, 20, "geologist_corrected")],
        curves: [curve("ngamma", 0, 120)],
        seams: [seam("A", 40, 42)],
        coreImages: 1,
        collar: { coalgrid_easting: 1000, coalgrid_northing: 2000 },
      }),
    );

    expect(queue).toContainEqual(
      expect.objectContaining({
        id: "workflow:correction-progress",
        priority: "watch",
        source: "workflow",
        depth: 0,
        evidence: "1/2 intervals corrected",
      }),
    );
  });
});

function borehole(
  options: {
    validation_issues?: ValidationIssue[];
    ai_suggestions?: AiSuggestion[];
    curves?: Curve[];
    intervals?: LithologyInterval[];
    seams?: SeamInterval[];
    coreImages?: number;
    collar?: Record<string, unknown>;
  } = {},
): BoreholeWorkbench {
  return {
    id: 1,
    code: "BH-1",
    title: "BH-1",
    state: null,
    total_depth: 120,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "ready_for_central_review",
    attributes: { collar: options.collar ?? {} },
    layout: null,
    display_layouts: [],
    lithology_intervals: options.intervals ?? [interval(0, 120)],
    seam_intervals: options.seams ?? [],
    core_images: Array.from({ length: options.coreImages ?? 0 }, (_, index) => ({
      box_number: index + 1,
      name: `Box ${index + 1}`,
      file_path: `box-${index + 1}.jpg`,
      from_depth: index,
      to_depth: index + 1,
      url: `/box-${index + 1}.jpg`,
      original_url: `/box-${index + 1}.jpg`,
      strip_url: null,
      image_metadata: null,
      strip_metadata: null,
    })),
    curves: options.curves ?? [],
    validation_issues: options.validation_issues ?? [],
    ai_suggestions: options.ai_suggestions ?? [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
    correction_audits: [],
  };
}

function issue(id: number, severity: ValidationIssue["severity"], code: string, message: string): ValidationIssue {
  return {
    id,
    code,
    severity,
    message,
    from_depth: id,
    to_depth: id + 1,
    entity_type: "interval",
    entity_id: String(id),
    status: "open",
    issue_metadata: null,
  };
}

function suggestion(id: number, depth: number, confidence: number): AiSuggestion {
  return {
    id,
    validation_issue_id: null,
    suggestion_type: "review",
    title: "Review seam boundary",
    rationale: "Curve response changes near the boundary.",
    recommended_action: "Check the seam boundary against gamma and lithology.",
    confidence,
    status: "open",
    provider: "rules",
    from_depth: depth,
    to_depth: depth,
    entity_type: "interval",
    entity_id: String(id),
    patch: null,
    evidence: null,
  };
}

function curve(key: string, fromDepth: number, toDepth: number): Curve {
  return {
    id: key.length,
    key,
    label: key,
    unit: "API",
    source_type: "las",
    color: "#ef4444",
    samples: [
      { depth: fromDepth, value: 50 },
      { depth: toDepth, value: 75 },
    ],
  };
}

function interval(fromDepth: number, toDepth: number, dataStage?: string): LithologyInterval {
  return {
    id: `${fromDepth}-${toDepth}`,
    source_row: null,
    from_depth: fromDepth,
    to_depth: toDepth,
    lithology_code: "SST",
    lithology_label: "Sandstone",
    display_color: null,
    logged_color: null,
    seam_name: null,
    recovery: null,
    recovery_percent: null,
    rqd: null,
    structural_features: null,
    remark: null,
    image_box: null,
    image_file: null,
    attributes: dataStage ? { data_stage: dataStage } : null,
  };
}

function seam(name: string, fromDepth: number, toDepth: number): SeamInterval {
  return {
    id: `${name}:${fromDepth}`,
    name,
    from_depth: fromDepth,
    to_depth: toDepth,
    thickness: toDepth - fromDepth,
    lithology_code: "COAL",
    lithology_label: "Coal",
    image_box: null,
  };
}
