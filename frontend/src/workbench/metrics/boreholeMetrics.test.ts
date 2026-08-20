import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildBoreholeMetrics } from "./boreholeMetrics";

describe("buildBoreholeMetrics", () => {
  it("derives single-value metrics from canonical borehole data", () => {
    const metrics = buildBoreholeMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES);

    expect(metrics.get("total_depth")?.value).toBe("125.5 m");
    expect(metrics.get("interval_count")?.value).toBe("2");
    expect(metrics.get("seam_count")?.value).toBe("1");
    expect(metrics.get("avg_recovery")?.value).toBe("82.5 %");
    expect(metrics.get("avg_rqd")?.value).toBe("55 %");
    expect(metrics.get("curve_gamma_max")?.value).toBe("98 API");
  });

  it("converts depth and coordinate metrics for imperial preferences", () => {
    const metrics = buildBoreholeMetrics(sampleWorkbench(), {
      ...DEFAULT_USER_PREFERENCES,
      depthUnit: "ft",
      coordinateUnit: "ft",
      numberFormat: "en-US",
    });

    expect(metrics.get("total_depth")?.value).toBe("411.75 ft");
    expect(metrics.get("coalgrid_easting")?.value).toBe("4,050.52 ft");
  });
});

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "TEST-01",
    title: "Test Borehole",
    state: "Jharkhand",
    total_depth: 125.5,
    source_workbook: "test.xlsx",
    source_sheet: "Sheet1",
    closure_note: null,
    workflow_status: "draft",
    attributes: {
      collar: {
        coalgrid_easting: 1234.6,
      },
    },
    layout: null,
    lithology_intervals: [
      {
        id: "1",
        from_depth: 0,
        to_depth: 10,
        lithology_code: "SST",
        lithology_label: "Sandstone",
        display_color: null,
        logged_color: null,
        seam_name: null,
        recovery: null,
        recovery_percent: 80,
        rqd: 0.5,
        structural_features: null,
        remark: null,
        source_row: null,
        image_box: null,
        image_file: null,
      },
      {
        id: "2",
        from_depth: 10,
        to_depth: 15,
        lithology_code: "COAL",
        lithology_label: "Coal",
        display_color: null,
        logged_color: null,
        seam_name: "A",
        recovery: null,
        recovery_percent: 85,
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
        id: "1",
        name: "A",
        from_depth: 10,
        to_depth: 15,
        thickness: 5,
        lithology_code: "COAL",
        lithology_label: "Coal",
        image_box: null,
      },
    ],
    core_images: [],
    curves: [
      {
        id: 1,
        key: "gamma",
        label: "Gamma",
        unit: "API",
        color: "#dd3333",
        source_type: "las",
        samples: [
          { depth: 0, value: 45 },
          { depth: 10, value: 98 },
        ],
      },
    ],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
