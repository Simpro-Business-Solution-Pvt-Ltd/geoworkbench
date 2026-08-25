import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, SeamInterval } from "../../api/types";
import { buildSeamTieLines } from "./correlationTieLines";

describe("correlation tie lines", () => {
  it("connects matching seams between adjacent boreholes", () => {
    const lines = buildSeamTieLines(
      [
        borehole("BH-1", [seam("A", 100, 102), seam("B", 140, 142)]),
        borehole("BH-2", [seam("a", 104, 108)]),
        borehole("BH-3", [seam("A", 120, 122)]),
      ],
      { min: 0, max: 200 },
      "depth",
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      seamName: "A",
      fromColumn: 0,
      toColumn: 1,
      status: "strong",
    });
    expect(lines[0].fromY).toBeCloseTo(50.5);
    expect(lines[0].toY).toBeCloseTo(53);
    expect(lines[1]).toMatchObject({ fromColumn: 1, toColumn: 2, status: "review" });
  });

  it("flags large adjacent seam offsets for review", () => {
    const lines = buildSeamTieLines(
      [borehole("BH-1", [seam("A", 100, 102)]), borehole("BH-2", [seam("A", 122, 124)])],
      { min: 0, max: 200 },
      "depth",
    );

    expect(lines[0]).toMatchObject({ status: "review", offset: 22 });
  });

  it("pairs repeated seam names by depth order instead of fanning every duplicate", () => {
    const lines = buildSeamTieLines(
      [
        borehole("BH-1", [seam("BAND", 20, 21), seam("BAND", 80, 81), seam("BAND", 140, 141)]),
        borehole("BH-2", [seam("BAND", 23, 24), seam("BAND", 84, 85)]),
      ],
      { min: 0, max: 200 },
      "depth",
    );

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.id)).toEqual(["1:2:BAND:0", "1:2:BAND:1"]);
    expect(lines[0].fromY).toBeCloseTo(10.25);
    expect(lines[0].toY).toBeCloseTo(11.75);
  });
});

function borehole(code: string, seams: SeamInterval[]): BoreholeWorkbench {
  return {
    id: Number(code.replace(/\D/g, "")) || 1,
    code,
    title: `${code} Borehole`,
    state: null,
    total_depth: 200,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "ready_for_central_review",
    attributes: { collar: { reduced_level: 250 } },
    layout: null,
    display_layouts: [],
    lithology_intervals: [],
    seam_intervals: seams,
    core_images: [],
    curves: [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}

function seam(name: string, from: number, to: number): SeamInterval {
  return {
    id: `${name}-${from}-${to}`,
    name,
    from_depth: from,
    to_depth: to,
    thickness: to - from,
    lithology_code: "COAL",
    lithology_label: "Coal",
    image_box: null,
    attributes: null,
  };
}
