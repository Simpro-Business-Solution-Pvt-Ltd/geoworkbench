import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import { metadataFor, rlLabel } from "./correlationMetadata";

describe("correlation metadata", () => {
  it("uses canonical collar attributes before import fallbacks", () => {
    const meta = metadataFor(
      sampleWorkbench({
        attributes: {
          collar: {
            reduced_level: 245.75,
            coalgrid_easting: "1000.5",
            coalgrid_northing: 2000.25,
            water_level: 12.5,
          },
        },
        source_imports: [
          {
            id: 1,
            import_type: "excel",
            source_name: "legacy.xlsx",
            status: "imported",
            summary: { metadata: { rl: 201.5, water_level: 9.8 } },
          },
        ],
      }),
    );

    expect(meta.rl).toBe(245.75);
    expect(meta.rlSource).toBe("collar");
    expect(meta.x).toBe(1000.5);
    expect(meta.y).toBe(2000.25);
    expect(meta.waterLevel).toBe(12.5);
    expect(rlLabel(meta)).toBe("RL 245.8m");
  });

  it("falls back to import metadata and legacy summaries", () => {
    const importMeta = metadataFor(
      sampleWorkbench({
        attributes: { collar: {} },
        source_imports: [
          {
            id: 1,
            import_type: "excel",
            source_name: "collar.xlsx",
            status: "imported",
            summary: { metadata: { rl: "205.4", water_level_m: "8.2", utm_easting: 33 } },
          },
        ],
      }),
    );
    const legacy = metadataFor(
      sampleWorkbench({
        attributes: null,
        source_imports: [
          {
            id: 2,
            import_type: "legacy",
            source_name: "demo",
            status: "imported",
            summary: { rl_m: 198.2, collar_x: 7, collar_y: 9 },
          },
        ],
      }),
    );

    expect(importMeta.rl).toBe(205.4);
    expect(importMeta.rlSource).toBe("import");
    expect(importMeta.waterLevel).toBe(8.2);
    expect(importMeta.x).toBe(33);
    expect(legacy.rl).toBe(198.2);
    expect(legacy.rlSource).toBe("import");
    expect(legacy.x).toBe(7);
    expect(legacy.y).toBe(9);
  });

  it("marks RL as estimated when no datum is available", () => {
    const meta = metadataFor(sampleWorkbench({ attributes: null, source_imports: [] }));

    expect(meta.rl).toBe(220);
    expect(meta.rlSource).toBe("default");
    expect(rlLabel(meta)).toBe("RL est. 220.0m");
  });
});

function sampleWorkbench(overrides: Partial<BoreholeWorkbench> = {}): BoreholeWorkbench {
  return {
    id: 1,
    code: "MGCA-08",
    title: "MGCA-08 Reliance Borehole",
    state: null,
    total_depth: 801,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "ready_for_central_review",
    attributes: {},
    layout: null,
    display_layouts: [],
    lithology_intervals: [],
    seam_intervals: [],
    core_images: [],
    curves: [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
    correction_audits: [],
    ...overrides,
  };
}

