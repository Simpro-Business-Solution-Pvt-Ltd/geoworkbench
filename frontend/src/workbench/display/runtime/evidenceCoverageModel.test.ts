import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, Curve, LithologyInterval } from "../../../api/types";
import { buildEvidenceCoverage } from "./evidenceCoverageModel";

describe("evidenceCoverageModel", () => {
  it("summarizes available evidence and correction progress", () => {
    const rows = buildEvidenceCoverage(
      borehole({
        intervals: [interval(0, 10, "raw_imported"), interval(10, 20, "geologist_corrected")],
        curves: [curve(0, 100)],
        coreImages: 1,
        collar: { coalgrid_easting: 1000, coalgrid_northing: 2000 },
        sourceImports: 1,
      }),
    );

    expect(row(rows, "Lithology")).toMatchObject({ status: "available", value: "2 intervals" });
    expect(row(rows, "Curves")).toMatchObject({ status: "available", value: "1 curves · 83%" });
    expect(row(rows, "Corrections")).toMatchObject({ status: "partial", value: "50%" });
    expect(row(rows, "Collar")).toMatchObject({ status: "available", value: "coalgrid" });
  });

  it("makes missing evidence explicit without relying on validation", () => {
    const rows = buildEvidenceCoverage(borehole({ intervals: [] }));

    expect(row(rows, "Lithology")).toMatchObject({ status: "missing", value: "0 intervals" });
    expect(row(rows, "Curves")).toMatchObject({ status: "missing", value: "0 curves" });
    expect(row(rows, "Core images")).toMatchObject({ status: "missing", value: "not supplied" });
    expect(row(rows, "Collar")).toMatchObject({ status: "missing", value: "missing" });
  });
});

function row(rows: ReturnType<typeof buildEvidenceCoverage>, label: string) {
  return rows.find((item) => item.label === label);
}

function borehole(
  options: {
    intervals?: LithologyInterval[];
    curves?: Curve[];
    coreImages?: number;
    collar?: Record<string, unknown>;
    sourceImports?: number;
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
    seam_intervals: [],
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
    validation_issues: [],
    ai_suggestions: [],
    source_imports: Array.from({ length: options.sourceImports ?? 0 }, (_, index) => ({
      id: index + 1,
      borehole_id: 1,
      source_name: `source-${index + 1}.xlsx`,
      import_type: "excel",
      status: "merged",
      summary: {},
      created_at: "2026-08-24T00:00:00Z",
    })),
    field_submissions: [],
    source_files: [],
    correction_audits: [],
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

function curve(fromDepth: number, toDepth: number): Curve {
  return {
    id: 1,
    key: "ngamma",
    label: "Natural Gamma",
    unit: "API",
    source_type: "las",
    color: "#ef4444",
    samples: [
      { depth: fromDepth, value: 50 },
      { depth: toDepth, value: 75 },
    ],
  };
}
