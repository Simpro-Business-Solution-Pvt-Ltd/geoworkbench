import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, LithologyInterval } from "../../../api/types";
import { createDepthScale } from "../../core/depthScale";
import { buildRemarkGroupRenderModels, findRemarkGroupAtY } from "./remarksRenderModel";

describe("remarksRenderModel", () => {
  it("groups nearby visible remarks by rendered pixel distance", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const groups = buildRemarkGroupRenderModels(
      workbench([
        interval("a", 10, "first"),
        interval("b", 12, "second"),
        interval("c", 40, "third"),
        interval("hidden", 90, "hidden"),
      ]),
      scale,
      { fromDepth: 0, toDepth: 50 },
      { bucketPixels: 6 },
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].count).toBe(2);
    expect(groups[0].label).toBe("10.0m group");
    expect(groups[0].text).toBe("first; second");
    expect(groups[1].label).toBe("third");
  });

  it("finds remark groups by rendered y hit window", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);
    const groups = buildRemarkGroupRenderModels(
      workbench([interval("a", 10, "first")]),
      scale,
      { fromDepth: 0, toDepth: 50 },
      { bucketPixels: 6 },
    );

    expect(findRemarkGroupAtY(groups, groups[0].y + 10, 26)?.key).toBe(groups[0].key);
    expect(findRemarkGroupAtY(groups, groups[0].y + 40, 26)).toBeNull();
  });
});

function interval(id: string, fromDepth: number, remark: string): LithologyInterval {
  return {
    id,
    source_row: null,
    from_depth: fromDepth,
    to_depth: fromDepth + 1,
    lithology_code: "COAL",
    lithology_label: "Coal",
    display_color: null,
    logged_color: null,
    seam_name: null,
    recovery: null,
    recovery_percent: null,
    rqd: null,
    structural_features: null,
    remark,
    image_box: null,
    image_file: null,
  };
}

function workbench(lithology_intervals: LithologyInterval[]): BoreholeWorkbench {
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
    lithology_intervals,
    seam_intervals: [],
    curves: [],
    core_images: [],
    layout: null,
    display_layouts: [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
    correction_audits: [],
  };
}
