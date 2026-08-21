import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth, formatNumber } from "../../preferences/userPreferences";
import { buildCollarMetrics } from "./collarMetrics";
import { buildCurveMetrics } from "./curveMetrics";
import { buildIntervalMetrics } from "./intervalMetrics";
import type { BoreholeMetric } from "./metricTypes";

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

  return metrics;
}

export function metricValue(metricKey: string, data: BoreholeWorkbench, preferences: UserPreferences) {
  return buildBoreholeMetrics(data, preferences).get(metricKey)?.value ?? "-";
}

function addMetric(metrics: Map<string, BoreholeMetric>, metric: BoreholeMetric) {
  metrics.set(metric.key, metric);
}
