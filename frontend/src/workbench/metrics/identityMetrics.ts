import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatDepth } from "../../preferences/userPreferences";
import type { BoreholeMetric } from "./metricTypes";

export function buildIdentityMetrics(data: BoreholeWorkbench, preferences: UserPreferences): BoreholeMetric[] {
  return [
    {
      key: "total_depth",
      label: "Total depth",
      value: formatDepth(data.total_depth, preferences),
      rawValue: data.total_depth,
      unit: preferences.depthUnit,
      category: "identity",
      source: "excel",
    },
  ];
}
