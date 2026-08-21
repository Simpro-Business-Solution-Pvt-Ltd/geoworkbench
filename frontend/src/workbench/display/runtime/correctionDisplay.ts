import type { CorrectionAudit, LithologyInterval } from "../../../api/types";

const FIELD_LABELS: Record<string, string> = {
  from_depth: "From depth",
  to_depth: "To depth",
  lithology_code: "Lithology code",
  lithology_label: "Lithology label",
  logged_color: "Logged color",
  seam_name: "Seam",
  recovery: "Recovery",
  recovery_percent: "Recovery %",
  rqd: "RQD",
  structural_features: "Structural features",
  remark: "Remarks",
};

const CORRECTED_STAGES = new Set(["geologist_corrected", "approved_final"]);

export function intervalStageKey(interval: Pick<LithologyInterval, "attributes">): string {
  const stage = interval.attributes?.data_stage;
  return typeof stage === "string" && stage ? stage : "unknown";
}

export function intervalStageLabel(interval: Pick<LithologyInterval, "attributes">): string {
  const label = interval.attributes?.data_stage_label;
  if (typeof label === "string" && label) return label;
  const stage = intervalStageKey(interval);
  return stage === "unknown" ? "Unstaged" : stage.replace(/_/g, " ");
}

export function isCorrectedInterval(interval: Pick<LithologyInterval, "attributes">): boolean {
  return CORRECTED_STAGES.has(intervalStageKey(interval));
}

export function correctionFieldLabels(audit: Pick<CorrectionAudit, "after_values">): string[] {
  return Object.keys(audit.after_values)
    .filter((field) => field !== "attributes")
    .map((field) => FIELD_LABELS[field] ?? field.replace(/_/g, " "));
}

export function correctionFieldSummary(audit: Pick<CorrectionAudit, "after_values">): string {
  const fields = correctionFieldLabels(audit);
  return fields.length ? fields.join(", ") : "Metadata";
}

export function correctionValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
  if (typeof value === "object") return "metadata";
  return String(value);
}

export function correctionChangePreview(audit: Pick<CorrectionAudit, "before_values" | "after_values">): string {
  const fields = Object.keys(audit.after_values).filter((field) => field !== "attributes").slice(0, 3);
  if (!fields.length) return "Metadata updated";
  return fields
    .map((field) => {
      const label = FIELD_LABELS[field] ?? field.replace(/_/g, " ");
      return `${label}: ${correctionValue(audit.before_values[field])} -> ${correctionValue(audit.after_values[field])}`;
    })
    .join(" · ");
}
