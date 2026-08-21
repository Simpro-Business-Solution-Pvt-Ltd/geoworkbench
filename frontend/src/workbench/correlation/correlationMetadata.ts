import type { BoreholeWorkbench } from "../../api/types";

export type BoreholeMeta = {
  rl: number;
  rlSource: "collar" | "import" | "default";
  x: number | null;
  y: number | null;
  waterLevel: number | null;
};

const DEFAULT_RL = 220;

export function metadataFor(data: BoreholeWorkbench): BoreholeMeta {
  const attributes = objectValue(data.attributes);
  const collar = objectValue(attributes.collar);
  const importMetadata = mergedImportMetadata(data);
  const legacySummary = data.source_imports.find((item) => item.summary?.rl_m)?.summary ?? {};

  const collarRl = firstNumber(collar, ["reduced_level", "rl", "rl_m"]);
  const importRl = firstNumber(importMetadata, ["reduced_level", "rl", "rl_m"]);
  const legacyRl = numberValue(legacySummary.rl_m);
  const rl = collarRl ?? importRl ?? legacyRl ?? DEFAULT_RL;
  const rlSource: BoreholeMeta["rlSource"] =
    collarRl !== null ? "collar" : importRl !== null || legacyRl !== null ? "import" : "default";

  return {
    rl,
    rlSource,
    x:
      firstNumber(collar, ["coalgrid_easting", "utm_easting", "collar_x"]) ??
      firstNumber(importMetadata, ["coalgrid_easting", "utm_easting", "collar_x"]) ??
      numberValue(legacySummary.collar_x),
    y:
      firstNumber(collar, ["coalgrid_northing", "utm_northing", "collar_y"]) ??
      firstNumber(importMetadata, ["coalgrid_northing", "utm_northing", "collar_y"]) ??
      numberValue(legacySummary.collar_y),
    waterLevel:
      firstNumber(collar, ["water_level", "water_level_m"]) ??
      firstNumber(importMetadata, ["water_level", "water_level_m"]) ??
      numberValue(legacySummary.water_level_m),
  };
}

export function rlLabel(meta: BoreholeMeta): string {
  const suffix = meta.rlSource === "default" ? " est." : "";
  return `RL${suffix} ${meta.rl.toFixed(1)}m`;
}

function mergedImportMetadata(data: BoreholeWorkbench): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const sourceImport of data.source_imports) {
    const summary = objectValue(sourceImport.summary);
    Object.assign(merged, objectValue(summary.metadata));
    Object.assign(merged, objectValue(summary.collar));
  }
  return merged;
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = numberValue(source[key]);
    if (value !== null) return value;
  }
  return null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

