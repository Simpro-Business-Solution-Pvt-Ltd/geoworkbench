import type { Curve, DisplayWidget } from "../../../api/types";
import { LogWidgetSettings } from "./LogWidgetSettings";

type Props = {
  widgetId: string;
  widget: DisplayWidget;
  availableCurves: Curve[];
  onClose: () => void;
  onUpdateWidget: (updater: (widget: DisplayWidget) => DisplayWidget) => void;
};

export function WidgetSettingsDialog({ widgetId, widget, availableCurves, onClose, onUpdateWidget }: Props) {
  return (
    <div className="widget-settings-modal" role="dialog" aria-modal="true">
      <div className="image-modal-header">
        <strong>{widget.title} Settings</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="widget-settings-body">
        <label>
          Widget title
          <input value={widget.title} onChange={(event) => onUpdateWidget((item) => ({ ...item, title: event.target.value }))} />
        </label>
        {widget.type === "logWidget" ? (
          <LogWidgetSettings widget={widget} availableCurves={availableCurves} onUpdateWidget={onUpdateWidget} />
        ) : (
          <div className="settings-note">
            {widgetId} stores widget-level settings in display JSON. Specialized controls can be added here as each widget matures.
          </div>
        )}
      </div>
    </div>
  );
}
