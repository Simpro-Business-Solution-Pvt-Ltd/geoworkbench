import { describe, expect, it } from "vitest";

import type { SourceFile, SourceImport } from "../../api/types";
import { sourceFileAuditFacts, sourceImportAuditFacts } from "./importAuditFacts";

describe("import audit facts", () => {
  it("summarizes source-file parse and merge evidence", () => {
    const facts = sourceFileAuditFacts({
      id: 1,
      borehole_id: 10,
      source_import_id: 2,
      file_type: "excel",
      original_name: "CTSJ.xlsx",
      storage_path: "uploads/CTSJ.xlsx",
      status: "merged",
      file_metadata: {
        storage_mode: "local",
        size_bytes: 2048,
        parse_summary: { parser: "excel_profile", row_count: 5 },
        merge_summary: {
          merge_mode: "known_excel_template_first_log",
          template: "ctsj_descriptive_v1",
          lithology_intervals: 40,
          seam_intervals: 7,
          range: { from_depth: 100, to_depth: 180 },
          merge_options: { interval_mode: "replace_overlapping_range" },
        },
      },
    } satisfies SourceFile);

    expect(facts).toContainEqual({ label: "Size", value: "2.0 KB" });
    expect(facts).toContainEqual({ label: "Adapter", value: "known excel template first log" });
    expect(facts).toContainEqual({ label: "Template", value: "ctsj descriptive v1" });
    expect(facts).toContainEqual({ label: "Rows", value: "40" });
    expect(facts).toContainEqual({ label: "Depth", value: "100.00-180.00m" });
  });

  it("summarizes parsed import batches", () => {
    const facts = sourceImportAuditFacts({
      id: 2,
      import_type: "las",
      source_name: "CTSJ.las",
      status: "merged",
      summary: {
        merge_mode: "las_curves",
        curves: [{ key: "GR" }, { key: "RHOB" }],
        min_depth: 250,
        max_depth: 620,
      },
    } satisfies SourceImport);

    expect(facts).toContainEqual({ label: "Adapter", value: "las curves" });
    expect(facts).toContainEqual({ label: "Curves", value: "2" });
    expect(facts).toContainEqual({ label: "Depth", value: "250.00-620.00m" });
  });
});
