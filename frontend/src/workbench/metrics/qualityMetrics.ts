import type { BoreholeWorkbench } from "../../api/types";
import type { UserPreferences } from "../../preferences/userPreferences";
import { formatNumber } from "../../preferences/userPreferences";
import type { BoreholeMetric } from "./metricTypes";

export function buildQualityMetrics(data: BoreholeWorkbench, preferences: UserPreferences): BoreholeMetric[] {
  return [
    {
      key: "validation_issue_count",
      label: "Validation issues",
      value: formatNumber(data.validation_issues.length, preferences, 0),
      rawValue: data.validation_issues.length,
      category: "quality",
      source: "rules",
    },
    {
      key: "ai_suggestion_count",
      label: "AI suggestions",
      value: formatNumber(data.ai_suggestions.length, preferences, 0),
      rawValue: data.ai_suggestions.length,
      category: "ai",
      source: "ai",
    },
  ];
}
