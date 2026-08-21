import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatMeasurement } from "../../preferences/userPreferences";
import type { BoreholeMetric } from "./metricTypes";

export function buildCollarMetrics(data: BoreholeWorkbench, preferences: UserPreferences): BoreholeMetric[] {
  const attributes = objectValue(data.attributes);
  const collar = objectValue(attributes.collar);
  const excelMetadata = excelImportMetadata(data);
  const metrics: BoreholeMetric[] = [];

  addOptionalMeasurement(metrics, "reduced_level", "Reduced level", valueFrom(collar, excelMetadata, "reduced_level", "rl"), "m", preferences);
  addOptionalMeasurement(metrics, "water_level", "Water level", valueFrom(collar, excelMetadata, "water_level"), "m", preferences);
  addOptionalCoordinate(metrics, "coalgrid_easting", "Coalgrid easting", collar.coalgrid_easting, preferences);
  addOptionalCoordinate(metrics, "coalgrid_northing", "Coalgrid northing", collar.coalgrid_northing, preferences);
  addOptionalCoordinate(metrics, "utm_easting", "UTM easting", collar.utm_easting, preferences);
  addOptionalCoordinate(metrics, "utm_northing", "UTM northing", collar.utm_northing, preferences);

  return metrics;
}

function addOptionalMeasurement(
  metrics: BoreholeMetric[],
  key: string,
  label: string,
  value: unknown,
  sourceUnit: string,
  preferences: UserPreferences,
) {
  const numeric = numericValue(value);
  metrics.push({
    key,
    label,
    value: numeric === null ? "-" : formatMeasurement(numeric, sourceUnit, preferences.depthUnit, preferences),
    rawValue: numeric,
    unit: preferences.depthUnit,
    category: "collar",
    source: "excel",
  });
}

function addOptionalCoordinate(metrics: BoreholeMetric[], key: string, label: string, value: unknown, preferences: UserPreferences) {
  const numeric = numericValue(value);
  metrics.push({
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
