import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, Curve, LithologyInterval, SeamInterval } from "../../api/types";
import {
  buildCorrelationInsights,
  collarContextRows,
  correlationStats,
  formatDistance,
  seamCorrelationRows,
} from "./correlationInsights";

describe("correlation insights", () => {
  it("groups seam markers and reports missing boreholes", () => {
    const rows = seamCorrelationRows([
      borehole("BH-1", { seams: [seam("A", 100, 102), seam("B", 130, 131)] }),
      borehole("BH-2", { seams: [seam("a", 101, 104)] }),
      borehole("BH-3", { seams: [] }),
    ]);

    expect(rows[0].seamName).toBe("A");
    expect(rows[0].presentCount).toBe(2);
    expect(rows[0].missingCount).toBe(1);
    expect(rows[0].minThickness).toBe(2);
    expect(rows[0].maxThickness).toBe(3);
  });

  it("builds actionable review insights from seam and metadata gaps", () => {
    const items = [
      borehole("BH-1", {
        seams: [seam("A", 100, 102)],
        curves: [curve("ngam"), curve("res")],
        collar: { reduced_level: 240, coalgrid_easting: 1000, coalgrid_northing: 2000 },
      }),
      borehole("BH-2", {
        seams: [seam("A", 101, 105)],
        curves: [],
        collar: { reduced_level: 238, coalgrid_easting: 1100, coalgrid_northing: 2000 },
      }),
      borehole("BH-3", {
        seams: [],
        curves: [curve("ngam")],
        collar: {},
      }),
    ];
    const rows = seamCorrelationRows(items);
    const insights = buildCorrelationInsights(items, rows);

    expect(insights.map((item) => item.id)).toContain("missing:A");
    expect(insights.map((item) => item.id)).toContain("thickness:A");
    expect(insights.map((item) => item.id)).toContain("curve-gaps");
    expect(insights.map((item) => item.id)).toContain("missing-coordinates");
    expect(insights.map((item) => item.id)).toContain("rl-defaulted");
  });

  it("derives collar context and display stats", () => {
    const items = [
      borehole("BH-1", { collar: { reduced_level: 240, coalgrid_easting: 1000, coalgrid_northing: 2000 } }),
      borehole("BH-2", { collar: { reduced_level: 238, coalgrid_easting: 1300, coalgrid_northing: 2400 } }),
    ];
    const collars = collarContextRows(items);
    const rows = seamCorrelationRows(items);
    const stats = correlationStats(items, rows, collars, { min: 0, max: 300 }, "depth");

    expect(formatDistance(collars[0].distanceFromReference)).toBe("reference");
    expect(formatDistance(collars[1].distanceFromReference)).toBe("500 m");
    expect(stats.spatialLabel).toBe("within 500 m");
    expect(stats.rlDefaulted).toBe(false);
  });
});

function borehole(
  code: string,
  overrides: {
    seams?: SeamInterval[];
    curves?: Curve[];
    intervals?: LithologyInterval[];
    collar?: Record<string, unknown>;
  } = {},
): BoreholeWorkbench {
  return {
    id: Number(code.replace(/\D/g, "")) || 1,
    code,
    title: `${code} Borehole`,
    state: null,
    total_depth: 250,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "ready_for_central_review",
    attributes: { collar: overrides.collar ?? {} },
    layout: null,
    display_layouts: [],
    lithology_intervals: overrides.intervals ?? [],
    seam_intervals: overrides.seams ?? [],
    core_images: [],
    curves: overrides.curves ?? [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
    correction_audits: [],
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

function curve(key: string): Curve {
  return {
    id: key.length,
    key,
    label: key.toUpperCase(),
    unit: "",
    source_type: "las",
    color: "#ef4444",
    samples: [],
  };
}
