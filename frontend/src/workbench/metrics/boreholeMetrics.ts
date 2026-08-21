import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth } from "../../preferences/userPreferences";
import { buildCollarMetrics } from "./collarMetrics";
import { buildCurveMetrics } from "./curveMetrics";
import { buildIntervalMetrics } from "./intervalMetrics";
import type { BoreholeMetric } from "./metricTypes";
import { buildQualityMetrics } from "./qualityMetrics";

export function buildBoreholeMetrics(data: BoreholeWorkbench, preferences: UserPreferences) {
  const metrics = new Map<string, BoreholeMetric>();

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
  for (const metric of buildCollarMetrics(data, preferences)) addMetric(metrics, metric);
  for (const metric of buildQualityMetrics(data, preferences)) addMetric(metrics, metric);

  return metrics;
}

export function metricValue(metricKey: string, data: BoreholeWorkbench, preferences: UserPreferences) {
  return buildBoreholeMetrics(data, preferences).get(metricKey)?.value ?? "-";
}

function addMetric(metrics: Map<string, BoreholeMetric>, metric: BoreholeMetric) {
  metrics.set(metric.key, metric);
}
