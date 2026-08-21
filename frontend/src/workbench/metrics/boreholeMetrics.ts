import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth, formatMeasurement, formatNumber } from "../../preferences/userPreferences";
import { buildCurveMetrics } from "./curveMetrics";
import type { BoreholeMetric } from "./metricTypes";

export function buildBoreholeMetrics(data: BoreholeWorkbench, preferences: UserPreferences) {
  const metrics = new Map<string, BoreholeMetric>();
  const attributes = (data.attributes ?? {}) as Record<string, unknown>;
  const collar = objectValue(attributes.collar);
  const excelMetadata = excelImportMetadata(data);
  const seamThickness = data.seam_intervals.reduce((sum, item) => sum + Math.max(0, item.to_depth - item.from_depth), 0);
  const recoveryValues = data.lithology_intervals
    .map((item) => item.recovery_percent)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const rqdValues = data.lithology_intervals
    .map((item) => item.rqd)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  addMetric(metrics, {
    key: "total_depth",
    label: "Total depth",
    value: formatDepth(data.total_depth, preferences),
    rawValue: data.total_depth,
    unit: preferences.depthUnit,
    category: "identity",
    source: "excel",
  });
  addMetric(metrics, {
    key: "interval_count",
    label: "Lithology intervals",
    value: formatNumber(data.lithology_intervals.length, preferences, 0),
    rawValue: data.lithology_intervals.length,
    category: "interval",
    source: "derived",
  });
  for (const metric of buildCurveMetrics(data, preferences)) addMetric(metrics, metric);
  addMetric(metrics, {
    key: "corebox_count",
    label: "Core images",
    value: formatNumber(data.core_images.length, preferences, 0),
    rawValue: data.core_images.length,
    category: "interval",
    source: "derived",
  });
  addMetric(metrics, {
    key: "seam_count",
    label: "Seams",
    value: formatNumber(data.seam_intervals.length, preferences, 0),
    rawValue: data.seam_intervals.length,
    category: "interval",
    source: "derived",
  });
  addMetric(metrics, {
    key: "seam_thickness",
    label: "Seam thickness",
    value: formatDepth(seamThickness, preferences),
    rawValue: seamThickness,
    unit: preferences.depthUnit,
    category: "interval",
    source: "derived",
  });
  addMetric(metrics, {
    key: "avg_recovery",
    label: "Average recovery",
    value: recoveryValues.length ? `${formatNumber(average(recoveryValues), preferences, 1)} %` : "-",
    rawValue: recoveryValues.length ? average(recoveryValues) : null,
    unit: "%",
    category: "interval",
    source: "excel",
  });
  addMetric(metrics, {
    key: "avg_rqd",
    label: "Average RQD",
    value: rqdValues.length ? `${formatNumber(average(rqdValues) * 100, preferences, 1)} %` : "-",
    rawValue: rqdValues.length ? average(rqdValues) : null,
    unit: "%",
    category: "interval",
    source: "excel",
  });
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

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
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
