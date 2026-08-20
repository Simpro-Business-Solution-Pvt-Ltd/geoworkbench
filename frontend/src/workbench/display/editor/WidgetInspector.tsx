import type { Curve, DisplayGridItem, DisplayWidget } from "../../../api/types";

const SINGLE_VALUE_METRICS = [
  { value: "total_depth", label: "Total depth" },
  { value: "interval_count", label: "Lithology intervals" },
  { value: "curve_count", label: "Curves" },
  { value: "curve_depth_from", label: "Curve coverage from" },
  { value: "curve_depth_to", label: "Curve coverage to" },
  { value: "curve_coverage_percent", label: "Curve coverage %" },
  { value: "corebox_count", label: "Corebox images" },
  { value: "seam_count", label: "Seams" },
  { value: "seam_thickness", label: "Seam thickness" },
  { value: "avg_recovery", label: "Average recovery" },
  { value: "avg_rqd", label: "Average RQD" },
  { value: "reduced_level", label: "Reduced level" },
  { value: "water_level", label: "Water level" },
  { value: "coalgrid_easting", label: "Coalgrid easting" },
  { value: "coalgrid_northing", label: "Coalgrid northing" },
  { value: "utm_easting", label: "UTM easting" },
  { value: "utm_northing", label: "UTM northing" },
  { value: "validation_issue_count", label: "Validation issues" },
  { value: "ai_suggestion_count", label: "AI suggestions" },
];

type Props = {
  widgetId: string;
  widget: DisplayWidget;
  gridItem: DisplayGridItem | null;
  availableCurves: Curve[];
  onOpenSettings: () => void;
  onClone: () => void;
  onRemove: () => void;
  onUpdateGrid: (patch: Partial<DisplayGridItem>) => void;
  onUpdateWidget: (updater: (widget: DisplayWidget) => DisplayWidget) => void;
};

export function WidgetInspector({
  widgetId,
  widget,
  gridItem,
  availableCurves,
  onOpenSettings,
  onClone,
  onRemove,
  onUpdateGrid,
  onUpdateWidget,
}: Props) {
  return (
    <div className="widget-settings-form">
      <small>{widgetId}</small>
      <label>
        Title
        <input value={widget.title} onChange={(event) => onUpdateWidget((item) => ({ ...item, title: event.target.value }))} />
      </label>
      {widget.type === "singleValue" && (
        <label>
          Metric
          <select
            value={widget.metric ?? "total_depth"}
            onChange={(event) => onUpdateWidget((item) => ({ ...item, metric: event.target.value }))}
          >
            {SINGLE_VALUE_METRICS.map((metric) => (
              <option key={metric.value} value={metric.value}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {gridItem && (
        <div className="grid-fieldset">
          {(["x", "y", "w", "h"] as const).map((field) => (
            <label key={field}>
              {field.toUpperCase()}
              <input
                type="number"
                min={field === "w" || field === "h" ? 1 : 0}
                max={field === "w" ? 12 : 30}
                value={gridItem[field]}
                onChange={(event) => onUpdateGrid({ [field]: Number(event.target.value) })}
              />
            </label>
          ))}
        </div>
      )}
      <div className="widget-action-row">
        <button type="button" onClick={onOpenSettings}>
          Widget settings
        </button>
        <button type="button" onClick={onClone}>
          Clone
        </button>
        <button type="button" onClick={onRemove}>
          Remove
        </button>
      </div>
      {widget.type === "logWidget" && (
        <small>{availableCurves.length} geophysical curve(s) are available for curve tracks.</small>
      )}
    </div>
  );
}
