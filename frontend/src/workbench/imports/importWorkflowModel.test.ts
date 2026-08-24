import { describe, expect, it } from "vitest";

import type { SourceFile } from "../../api/types";
import { sourceFileWorkflow } from "./importWorkflowModel";

describe("importWorkflowModel", () => {
  it("requires processing before merge for uploaded files", () => {
    expect(sourceFileWorkflow(sourceFile("uploaded"))).toMatchObject({
      nextStep: "Process source",
      canProcess: true,
      canMerge: false,
      tone: "working",
    });
  });

  it("allows merge review after parsing", () => {
    expect(sourceFileWorkflow(sourceFile("parsed", { file_type: "las", original_name: "BH-01.las" }))).toMatchObject({
      nextStep: "Review merge",
      detail: "Ready to merge curves by mnemonic/key.",
      canProcess: false,
      canMerge: true,
      tone: "ready",
    });
  });

  it("blocks merge when mapping or depth mapping is required", () => {
    expect(sourceFileWorkflow(sourceFile("mapping_required"))).toMatchObject({ canMerge: false, tone: "blocked" });
    expect(sourceFileWorkflow(sourceFile("linked_pending_depth_mapping"))).toMatchObject({
      canMerge: false,
      tone: "blocked",
    });
  });

  it("marks merged files as done", () => {
    expect(sourceFileWorkflow(sourceFile("merged"))).toMatchObject({
      nextStep: "Merged",
      canProcess: false,
      canMerge: false,
      tone: "done",
    });
  });
});

function sourceFile(status: string, overrides: Partial<SourceFile> = {}): SourceFile {
  return {
    id: 1,
    borehole_id: 1,
    source_import_id: null,
    file_type: "excel",
    original_name: "BH-01.xlsx",
    storage_path: "runtime-data/uploads/BH-01.xlsx",
    status,
    file_metadata: null,
    ...overrides,
  };
}
