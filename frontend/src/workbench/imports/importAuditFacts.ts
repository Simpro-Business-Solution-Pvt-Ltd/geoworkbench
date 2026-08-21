import type { SourceFile, SourceImport } from "../../api/types";

export type ImportAuditFact = {
  label: string;
  value: string;
};

export function sourceFileAuditFacts(item: SourceFile): ImportAuditFact[] {
  const metadata = objectValue(item.file_metadata);
  const parseSummary = objectValue(metadata.parse_summary);
  const mergeSummary = objectValue(metadata.merge_summary);
  const summary = Object.keys(mergeSummary).length ? mergeSummary : parseSummary;
  const facts: ImportAuditFact[] = [];

  addFact(facts, "Storage", labelValue(metadata.storage_mode));
  addFact(facts, "Size", fileSizeText(metadata.size_bytes));
  addFact(facts, "Adapter", labelValue(summary.parser ?? summary.merge_mode));
  addFact(facts, "Template", templateText(summary));
  addFact(facts, "Rows", numericText(summary.lithology_intervals ?? nestedValue(summary, ["summary", "lithology_interval_count"]) ?? summary.row_count));
  addFact(facts, "Seams", numericText(summary.seam_intervals ?? nestedValue(summary, ["summary", "seam_interval_count"])));
  addFact(facts, "Curves", curveCountText(summary));
  addFact(facts, "Depth", depthRangeText(summary.range ?? summary));
  addFact(facts, "Merge", labelValue(nestedValue(summary, ["merge_options", "interval_mode"]) ?? nestedValue(summary, ["merge_options", "curve_mode"])));

  return facts;
}

export function sourceImportAuditFacts(item: SourceImport): ImportAuditFact[] {
  const summary = objectValue(item.summary);
  const facts: ImportAuditFact[] = [];

  addFact(facts, "Adapter", labelValue(summary.parser ?? summary.merge_mode));
  addFact(facts, "Template", templateText(summary));
  addFact(facts, "Rows", numericText(summary.lithology_intervals ?? nestedValue(summary, ["summary", "lithology_interval_count"]) ?? summary.row_count));
  addFact(facts, "Seams", numericText(summary.seam_intervals ?? nestedValue(summary, ["summary", "seam_interval_count"])));
  addFact(facts, "Curves", curveCountText(summary));
  addFact(facts, "Depth", depthRangeText(summary.range ?? summary));

  return facts;
}

function addFact(facts: ImportAuditFact[], label: string, value: string | null) {
  if (!value) return;
  facts.push({ label, value });
}

function templateText(summary: Record<string, unknown>): string | null {
  const value =
    nestedValue(summary, ["profile", "template", "key"]) ??
    nestedValue(summary, ["profile", "template_key"]) ??
    summary.template ??
    summary.template_key;
  return labelValue(value);
}

function curveCountText(summary: Record<string, unknown>): string | null {
  if (Array.isArray(summary.curves)) return String(summary.curves.length);
  return numericText(summary.curve_count ?? nestedValue(summary, ["summary", "curve_count"]));
}

function depthRangeText(value: unknown): string | null {
  const range = objectValue(value);
  const fromDepth = range.from_depth ?? range.min_depth;
  const toDepth = range.to_depth ?? range.max_depth;
  if (fromDepth === undefined && toDepth === undefined) return null;
  return `${depthValueText(fromDepth ?? "start")}-${depthValueText(toDepth ?? "end")}m`;
}

function fileSizeText(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function numericText(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
}

function labelValue(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.replaceAll("_", " ");
}

function depthValueText(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : String(value);
}

function nestedValue(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const item of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[item];
  }
  return current;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
