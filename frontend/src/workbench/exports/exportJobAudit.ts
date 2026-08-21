import type { ExportJob } from "../../api/types";

export type ExportAuditFact = {
  label: string;
  value: string;
};

export function exportAuditFacts(job: ExportJob): ExportAuditFact[] {
  const summary = objectValue(job.summary);
  const depthRange = objectValue(summary.requested_depth_range);
  const stageCounts = objectValue(summary.data_stage_counts);
  const intervalStageCounts = objectValue(stageCounts.lithology_intervals);
  const curveStageCounts = objectValue(stageCounts.curves);
  const readiness = objectValue(summary.readiness);
  const facts: ExportAuditFact[] = [];

  addFact(facts, "Stage", labelValue(summary.requested_stage));
  addFact(facts, "Depth", depthRangeText(depthRange));
  addFact(facts, "Rows", numericText(summary.interval_count));
  addFact(facts, "Curves", numericText(summary.curve_count));
  addFact(facts, "Samples", numericText(summary.sample_depth_count));
  addFact(facts, "Readiness", labelValue(readiness.status));
  addFact(facts, "Interval stages", stageCountsText(intervalStageCounts));
  addFact(facts, "Curve stages", stageCountsText(curveStageCounts));

  return facts;
}

function addFact(facts: ExportAuditFact[], label: string, value: string | null) {
  if (!value) return;
  facts.push({ label, value });
}

function depthRangeText(range: Record<string, unknown>): string | null {
  const fromDepth = range.from_depth;
  const toDepth = range.to_depth;
  if (fromDepth === null && toDepth === null) return null;
  if (fromDepth === undefined && toDepth === undefined) return null;
  return `${valueText(fromDepth ?? "start")}-${valueText(toDepth ?? "end")}m`;
}

function stageCountsText(counts: Record<string, unknown>): string | null {
  const entries = Object.entries(counts).filter(([, value]) => typeof value === "number" && value > 0);
  if (!entries.length) return null;
  return entries.map(([stage, count]) => `${stage.replaceAll("_", " ")} ${count}`).join(", ");
}

function numericText(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function labelValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.replaceAll("_", " ");
}

function valueText(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

