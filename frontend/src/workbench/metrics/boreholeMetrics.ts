import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth, formatMeasurement, formatNumber } from "../../preferences/userPreferences";
import { buildCurveMetrics } from "./curveMetrics";
import { buildIntervalMetrics } from "./intervalMetrics";
import type { BoreholeMetric } from "./metricTypes";

export function buildBoreholeMetrics(data: BoreholeWorkbench, preferences: UserPreferences) {
  const metrics = new Map<string, BoreholeMetric>();
  const attributes = (data.attributes ?? {}) as Record<string, unknown>;
  const collar = objectValue(attributes.collar);
  const excelMetadata = excelImportMetadata(data);

  addMetric(metrics, {
    key: "total_depth",
    label: "Total depth",
    value: formatDepth(data.total_depth, preferences),
    rawValue: data.total_depth,
    unit: preferences.depthUnit,
    category: "identity",
    source: "excel",
  });
  for (const metric of buildIntervalMetrics(data, preferences)) addMetric(metrics, metric);
  for (const metric of buildCurveMetrics(data, preferences)) addMetric(metrics, metric);
  addMetric(metrics, {
    key: "validation_issue_count",
    label: "Validation issues",
    value: formatNumber(data.validation_issues.length, preferences, 0),
    rawValue: data.validation_issues.length,
    category: "quality",
    source: "rules",
  });
  addMetric(metrics, {
    key: "ai_suggestion_count",
    label: "AI suggestions",
    value: formatNumber(data.ai_suggestions.length, preferences, 0),
    rawValue: data.ai_suggestions.length,
    category: "ai",
    source: "ai",
  });

  addOptionalMeasurement(metrics, "reduced_level", "Reduced level", valueFrom(collar, excelMetadata, "reduced_level", "rl"), "m", preferences);
  addOptionalMeasurement(metrics, "water_level", "Water level", valueFrom(collar, excelMetadata, "water_level"), "m", preferences);
  addOptionalCoordinate(metrics, "coalgrid_easting", "Coalgrid easting", collar.coalgrid_easting, preferences);
  addOptionalCoordinate(metrics, "coalgrid_northing", "Coalgrid northing", collar.coalgrid_northing, preferences);
  addOptionalCoordinate(metrics, "utm_easting", "UTM easting", collar.utm_easting, preferences);
  addOptionalCoordinate(metrics, "utm_northing", "UTM northing", collar.utm_northing, preferences);

  return metrics;
}

export function metricValue(metricKey: string, data: BoreholeWorkbench, preferences: UserPreferences) {
  return buildBoreholeMetrics(data, preferences).get(metricKey)?.value ?? "-";
}

function addMetric(metrics: Map<string, BoreholeMetric>, metric: BoreholeMetric) {
  metrics.set(metric.key, metric);
}

function addOptionalMeasurement(
  metrics: Map<string, BoreholeMetric>,
  key: string,
  label: string,
  value: unknown,
  sourceUnit: string,
  preferences: UserPreferences,
) {
  const numeric = numericValue(value);
  addMetric(metrics, {
    key,
    label,
    value: numeric === null ? "-" : formatMeasurement(numeric, sourceUnit, preferences.depthUnit, preferences),
    rawValue: numeric,
    unit: preferences.depthUnit,
    category: "collar",
    source: "excel",
  });
}

function addOptionalCoordinate(
  metrics: Map<string, BoreholeMetric>,
  key: string,
  label: string,
  value: unknown,
  preferences: UserPreferences,
) {
  const numeric = numericValue(value);
  addMetric(metrics, {
    key,
    label,
    value: numeric === null ? "-" : formatMeasurement(numeric, "m", preferences.coordinateUnit, preferences),
    rawValue: numeric,
    unit: preferences.coordinateUnit,
    category: "collar",
    source: "excel",
  });
}

function excelImportMetadata(data: BoreholeWorkbench) {
  const excelImport = data.source_imports.find((item) => item.import_type === "excel");
  return objectValue(excelImport?.summary?.metadata);
}

function valueFrom(primary: Record<string, unknown>, secondary: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (primary[key] !== undefined && primary[key] !== null) return primary[key];
    if (secondary[key] !== undefined && secondary[key] !== null) return secondary[key];
  }
  return null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
