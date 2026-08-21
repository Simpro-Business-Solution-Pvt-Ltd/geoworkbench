import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth, formatNumber } from "../../preferences/userPreferences";
import type { BoreholeMetric } from "./metricTypes";

export function buildCurveMetrics(data: BoreholeWorkbench, preferences: UserPreferences): BoreholeMetric[] {
  const metrics: BoreholeMetric[] = [];
  const curveDepths = data.curves.flatMap((curve) =>
    curve.samples.map((sample) => sample.depth).filter((value) => Number.isFinite(value)),
  );
  const curveFromDepth = curveDepths.length ? Math.min(...curveDepths) : null;
  const curveToDepth = curveDepths.length ? Math.max(...curveDepths) : null;
  const curveCoveragePercent =
    curveFromDepth !== null && curveToDepth !== null && data.total_depth > 0
      ? Math.min(100, Math.max(0, ((curveToDepth - curveFromDepth) / data.total_depth) * 100))
      : null;

  metrics.push({
    key: "curve_count",
    label: "Curves",
    value: formatNumber(data.curves.length, preferences, 0),
    rawValue: data.curves.length,
    category: "curve",
    source: "las",
  });
  metrics.push({
    key: "curve_depth_from",
    label: "Curve coverage from",
    value: curveFromDepth === null ? "-" : formatDepth(curveFromDepth, preferences),
    rawValue: curveFromDepth,
    unit: preferences.depthUnit,
    category: "curve",
    source: "las",
  });
  metrics.push({
    key: "curve_depth_to",
    label: "Curve coverage to",
    value: curveToDepth === null ? "-" : formatDepth(curveToDepth, preferences),
    rawValue: curveToDepth,
    unit: preferences.depthUnit,
    category: "curve",
    source: "las",
  });
  metrics.push({
    key: "curve_coverage_percent",
    label: "Curve coverage",
    value: curveCoveragePercent === null ? "-" : `${formatNumber(curveCoveragePercent, preferences, 1)} %`,
    rawValue: curveCoveragePercent,
    unit: "%",
    category: "curve",
    source: "derived",
  });

  for (const curve of data.curves) {
    const values = curve.samples.map((sample) => sample.value).filter((value) => Number.isFinite(value));
    if (!values.length) continue;
    metrics.push({
      key: `curve_${curve.key}_min`,
      label: `${curve.label} min`,
      value: `${formatNumber(Math.min(...values), preferences, 2)} ${curve.unit}`,
      rawValue: Math.min(...values),
      unit: curve.unit,
      category: "curve",
      source: "las",
    });
    metrics.push({
      key: `curve_${curve.key}_max`,
      label: `${curve.label} max`,
      value: `${formatNumber(Math.max(...values), preferences, 2)} ${curve.unit}`,
      rawValue: Math.max(...values),
      unit: curve.unit,
      category: "curve",
      source: "las",
    });
  }

  return metrics;
}
