import type { BoreholeWorkbench } from "../../../api/types";
import type { UserPreferences } from "../../../preferences/userPreferences";
import { metricValue } from "../../metrics/boreholeMetrics";

export function SingleValueWidget({
  title,
  metric,
  data,
  preferences,
}: {
  title: string;
  metric: string;
  data: BoreholeWorkbench;
  preferences: UserPreferences;
}) {
  const value = metricValue(metric, data, preferences);
  return (
    <div className="runtime-kpi">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
