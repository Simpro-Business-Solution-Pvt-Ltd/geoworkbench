import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth, formatNumber } from "../../preferences/userPreferences";
import type { BoreholeMetric } from "./metricTypes";

const CORRECTED_STAGES = new Set(["geologist_corrected", "approved_final"]);

export function buildIntervalMetrics(data: BoreholeWorkbench, preferences: UserPreferences): BoreholeMetric[] {
  const seamThickness = data.seam_intervals.reduce((sum, item) => sum + Math.max(0, item.to_depth - item.from_depth), 0);
  const correctedIntervals = data.lithology_intervals.filter((item) => {
    const stage = item.attributes?.data_stage;
    return typeof stage === "string" && CORRECTED_STAGES.has(stage);
  });
  const correctedPercent = data.lithology_intervals.length
    ? (correctedIntervals.length / data.lithology_intervals.length) * 100
    : null;
  const recoveryValues = data.lithology_intervals
    .map((item) => item.recovery_percent)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const rqdValues = data.lithology_intervals
    .map((item) => item.rqd)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  return [
    {
      key: "interval_count",
      label: "Lithology intervals",
      value: formatNumber(data.lithology_intervals.length, preferences, 0),
      rawValue: data.lithology_intervals.length,
      category: "interval",
      source: "derived",
    },
    {
      key: "corrected_interval_count",
      label: "Corrected intervals",
      value: formatNumber(correctedIntervals.length, preferences, 0),
      rawValue: correctedIntervals.length,
      category: "interval",
      source: "derived",
    },
    {
      key: "corrected_interval_percent",
      label: "Correction progress",
      value: correctedPercent !== null ? `${formatNumber(correctedPercent, preferences, 1)} %` : "-",
      rawValue: correctedPercent,
      unit: "%",
      category: "interval",
      source: "derived",
    },
    {
      key: "corebox_count",
      label: "Core images",
      value: formatNumber(data.core_images.length, preferences, 0),
      rawValue: data.core_images.length,
      category: "interval",
      source: "derived",
    },
    {
      key: "seam_count",
      label: "Seams",
      value: formatNumber(data.seam_intervals.length, preferences, 0),
      rawValue: data.seam_intervals.length,
      category: "interval",
      source: "derived",
    },
    {
      key: "seam_thickness",
      label: "Seam thickness",
      value: formatDepth(seamThickness, preferences),
      rawValue: seamThickness,
      unit: preferences.depthUnit,
      category: "interval",
      source: "derived",
    },
    {
      key: "avg_recovery",
      label: "Average recovery",
      value: recoveryValues.length ? `${formatNumber(average(recoveryValues), preferences, 1)} %` : "-",
      rawValue: recoveryValues.length ? average(recoveryValues) : null,
      unit: "%",
      category: "interval",
      source: "excel",
    },
    {
      key: "avg_rqd",
      label: "Average RQD",
      value: rqdValues.length ? `${formatNumber(average(rqdValues) * 100, preferences, 1)} %` : "-",
      rawValue: rqdValues.length ? average(rqdValues) : null,
      unit: "%",
      category: "interval",
      source: "excel",
    },
  ];
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
