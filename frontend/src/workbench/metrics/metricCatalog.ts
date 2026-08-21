export type MetricCatalogItem = {
  value: string;
  label: string;
  category: "identity" | "collar" | "interval" | "curve" | "quality" | "ai";
};

export const SINGLE_VALUE_METRICS: MetricCatalogItem[] = [
  { value: "total_depth", label: "Total depth", category: "identity" },
  { value: "interval_count", label: "Lithology intervals", category: "interval" },
  { value: "curve_count", label: "Curves", category: "curve" },
  { value: "curve_depth_from", label: "Curve coverage from", category: "curve" },
  { value: "curve_depth_to", label: "Curve coverage to", category: "curve" },
  { value: "curve_coverage_percent", label: "Curve coverage %", category: "curve" },
  { value: "corebox_count", label: "Corebox images", category: "interval" },
  { value: "corrected_interval_count", label: "Corrected intervals", category: "interval" },
  { value: "corrected_interval_percent", label: "Correction progress %", category: "interval" },
  { value: "seam_count", label: "Seams", category: "interval" },
  { value: "seam_thickness", label: "Seam thickness", category: "interval" },
  { value: "avg_recovery", label: "Average recovery", category: "interval" },
  { value: "avg_rqd", label: "Average RQD", category: "interval" },
  { value: "reduced_level", label: "Reduced level", category: "collar" },
  { value: "water_level", label: "Water level", category: "collar" },
  { value: "coalgrid_easting", label: "Coalgrid easting", category: "collar" },
  { value: "coalgrid_northing", label: "Coalgrid northing", category: "collar" },
  { value: "utm_easting", label: "UTM easting", category: "collar" },
  { value: "utm_northing", label: "UTM northing", category: "collar" },
  { value: "validation_issue_count", label: "Validation issues", category: "quality" },
  { value: "ai_suggestion_count", label: "AI suggestions", category: "ai" },
];

export function metricLabel(metricKey: string) {
  return SINGLE_VALUE_METRICS.find((metric) => metric.value === metricKey)?.label ?? metricKey;
}
