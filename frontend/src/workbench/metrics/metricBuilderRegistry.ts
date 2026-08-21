import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { buildCollarMetrics } from "./collarMetrics";
import { buildCurveMetrics } from "./curveMetrics";
import { buildIdentityMetrics } from "./identityMetrics";
import { buildIntervalMetrics } from "./intervalMetrics";
import type { BoreholeMetric } from "./metricTypes";
import { buildQualityMetrics } from "./qualityMetrics";

export type BoreholeMetricBuilder = (data: BoreholeWorkbench, preferences: UserPreferences) => BoreholeMetric[];

export const BOREHOLE_METRIC_BUILDERS: BoreholeMetricBuilder[] = [
  buildIdentityMetrics,
  buildIntervalMetrics,
  buildCurveMetrics,
  buildCollarMetrics,
  buildQualityMetrics,
];

export function buildRegisteredMetrics(data: BoreholeWorkbench, preferences: UserPreferences) {
  return BOREHOLE_METRIC_BUILDERS.flatMap((builder) => builder(data, preferences));
}
