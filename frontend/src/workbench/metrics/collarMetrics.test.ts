import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { DEFAULT_USER_PREFERENCES } from "../../preferences/userPreferences";
import { buildCollarMetrics } from "./collarMetrics";

describe("buildCollarMetrics", () => {
  it("derives collar metrics from canonical collar attributes", () => {
    const metrics = new Map(buildCollarMetrics(sampleWorkbench(), DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("reduced_level")?.value).toBe("223.4 m");
    expect(metrics.get("water_level")?.value).toBe("14.25 m");
    expect(metrics.get("coalgrid_easting")?.value).toBe("1,234.5 m");
    expect(metrics.get("utm_northing")?.value).toBe("91,011.12 m");
  });

  it("falls back to Excel import metadata when collar measurements are absent", () => {
    const data = sampleWorkbench({
      attributes: { collar: {} },
      source_imports: [
        {
          id: 1,
          import_type: "excel",
          source_name: "collar.xlsx",
          status: "imported",
          summary: { metadata: { rl: "201.5", water_level: "9.8" } },
        },
      ],
    });
    const metrics = new Map(buildCollarMetrics(data, DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("reduced_level")?.value).toBe("201.5 m");
    expect(metrics.get("water_level")?.value).toBe("9.8 m");
  });

  it("keeps missing collar values explicit", () => {
    const data = sampleWorkbench({ attributes: null, source_imports: [] });
    const metrics = new Map(buildCollarMetrics(data, DEFAULT_USER_PREFERENCES).map((metric) => [metric.key, metric]));

    expect(metrics.get("coalgrid_easting")?.value).toBe("-");
    expect(metrics.get("water_level")?.rawValue).toBeNull();
  });
});

function sampleWorkbench(overrides: Partial<BoreholeWorkbench> = {}): BoreholeWorkbench {
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
    attributes: {
      collar: {
        reduced_level: 223.4,
        water_level: 14.25,
        coalgrid_easting: 1234.5,
        coalgrid_northing: 6789.1,
        utm_easting: 1112.13,
        utm_northing: 91011.12,
      },
    },
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
    ...overrides,
  };
}
