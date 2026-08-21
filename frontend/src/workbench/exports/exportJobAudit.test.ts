import { describe, expect, it } from "vitest";

import type { ExportJob } from "../../api/types";
import { exportAuditFacts } from "./exportJobAudit";

describe("exportAuditFacts", () => {
  it("summarizes export scope and provenance fields", () => {
    const facts = exportAuditFacts({
      id: 1,
      borehole_id: 1,
      export_type: "corrected_lithology_csv",
      status: "generated",
      file_path: "runtime-data/exports/BH/export.csv",
      file_name: "export.csv",
      summary: {
        requested_stage: "central_corrected",
        requested_depth_range: { from_depth: 10, to_depth: 20 },
        interval_count: 4,
        readiness: { status: "quality_review" },
        data_stage_counts: {
          lithology_intervals: { geologist_corrected: 3, raw_imported: 1 },
        },
      },
    } satisfies ExportJob);

    expect(facts).toEqual([
      { label: "Stage", value: "central corrected" },
      { label: "Depth", value: "10-20m" },
      { label: "Rows", value: "4" },
      { label: "Readiness", value: "quality review" },
      { label: "Interval stages", value: "geologist corrected 3, raw imported 1" },
    ]);
  });
});

