import type { SourceFile } from "../../api/types";

export type SourceFileWorkflow = {
  nextStep: string;
  detail: string;
  canProcess: boolean;
  canMerge: boolean;
  tone: "ready" | "working" | "blocked" | "done";
};

export function sourceFileWorkflow(item: SourceFile): SourceFileWorkflow {
  if (item.status === "merged") {
    return {
      nextStep: "Merged",
      detail: "Workbench data has been updated from this source.",
      canProcess: false,
      canMerge: false,
      tone: "done",
    };
  }
  if (item.status === "parsed") {
    return {
      nextStep: "Review merge",
      detail: mergeDetail(item),
      canProcess: false,
      canMerge: true,
      tone: "ready",
    };
  }
  if (item.status === "merge_pending_review") {
    return {
      nextStep: "Confirm merge",
      detail: "Automatic merge needs user-selected range or mode.",
      canProcess: true,
      canMerge: true,
      tone: "ready",
    };
  }
  if (item.status === "mapping_required") {
    return {
      nextStep: "Mapping required",
      detail: "Choose or edit a template before committing this file.",
      canProcess: true,
      canMerge: false,
      tone: "blocked",
    };
  }
  if (item.status === "linked_pending_depth_mapping") {
    return {
      nextStep: "Depth mapping required",
      detail: "File is stored, but image/depth mapping is not ready for merge.",
      canProcess: false,
      canMerge: false,
      tone: "blocked",
    };
  }
  if (item.status === "uploaded") {
    return {
      nextStep: "Process source",
      detail: "Detect parser/template and create a merge preview.",
      canProcess: true,
      canMerge: false,
      tone: "working",
    };
  }
  return {
    nextStep: "Review status",
    detail: item.file_metadata ? "Metadata is available for review." : "No parser/template facts are available yet.",
    canProcess: true,
    canMerge: false,
    tone: "working",
  };
}

function mergeDetail(item: SourceFile) {
  if (item.file_type === "las" || item.original_name.toLowerCase().endsWith(".las")) {
    return "Ready to merge curves by mnemonic/key.";
  }
  if (item.file_type === "excel" || item.original_name.toLowerCase().endsWith(".xlsx")) {
    return "Ready to merge interpreted intervals by depth range.";
  }
  if (item.file_type === "geophysical_pdf" || item.original_name.toLowerCase().endsWith(".pdf")) {
    return "Ready to merge digitized geophysical curves.";
  }
  return "Ready for merge options review.";
}
