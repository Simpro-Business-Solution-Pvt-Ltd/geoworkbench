import type { Curve, DisplayWidget } from "../../../api/types";
import { FloatingWindow } from "../../ui/FloatingWindow";
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
    <FloatingWindow
      title={`${widget.title} Settings`}
      className="widget-settings-modal"
      defaultPlacement="center"
      onClose={onClose}
    >
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
    </FloatingWindow>
  );
}
