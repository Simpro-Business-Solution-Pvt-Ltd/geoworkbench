import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../../api/types";
import { buildBoreholeMetadata } from "./intervalMetadata";

describe("buildBoreholeMetadata", () => {
  it("surfaces collar fallbacks and source evidence counts", () => {
    const metadata = new Map(buildBoreholeMetadata(sampleWorkbench()).map((item) => [item.label, item.value]));

    expect(metadata.get("Reduced level")).toBe("201.5");
    expect(metadata.get("Water level")).toBe("14.25");
    expect(metadata.get("Curves")).toBe("2");
    expect(metadata.get("Core images")).toBe("Not supplied");
    expect(metadata.get("Source files")).toBe("1");
    expect(metadata.get("Import batches")).toBe("1");
  });
});

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "MGCA-08",
    title: "MGCA-08 Reliance Borehole",
    state: "Reliance real data",
    total_depth: 801,
    source_workbook: "RelianceData/Data_10BH.zip",
    source_sheet: "Lithology_10BH.xlsx",
    closure_note: null,
    workflow_status: "imported_for_central_review",
    attributes: {
      collar: {
        water_level: 14.25,
        coalgrid_easting: 123.4,
      },
    },
    layout: null,
    display_layouts: [],
    lithology_intervals: [],
    seam_intervals: [],
    core_images: [],
    curves: [
      { id: 1, key: "gamma", label: "Natural Gamma", unit: "API", source_type: "las", color: "#000", curve_metadata: {}, samples: [] },
      { id: 2, key: "resistivity", label: "Resistivity", unit: "ohm-m", source_type: "las", color: "#111", curve_metadata: {}, samples: [] },
    ],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [
      {
        id: 1,
        import_type: "excel",
        source_name: "RelianceData/Data_10BH.zip",
        status: "imported",
        summary: { metadata: { rl: 201.5 } },
      },
    ],
    field_submissions: [],
    source_files: [
      {
        id: 1,
        borehole_id: 1,
        source_import_id: null,
        file_type: "las",
        original_name: "MGCA-08.las",
        storage_path: "uploads/MGCA-08.las",
        status: "merged",
        file_metadata: {},
      },
    ],
    correction_audits: [],
  };
}

