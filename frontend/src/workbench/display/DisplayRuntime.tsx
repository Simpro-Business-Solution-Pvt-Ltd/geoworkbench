import { Database } from "lucide-react";
import { useMemo, useState } from "react";

import type { DisplayLayout } from "../../api/types";
import { BoreholeExplorer } from "../explorer/BoreholeExplorer";
import { normalizeDisplayLayout } from "./displayEditorModel";
import { renderRuntimeWidget } from "./runtime/runtimeWidgetRegistry";
import type { DisplayRuntimeProps } from "./runtime/runtimeTypes";

export function DisplayRuntime(props: DisplayRuntimeProps) {
  const [explorerOpen, setExplorerOpen] = useState(false);
  const layout = useMemo(
    () => (props.data.layout ? normalizeDisplayLayout(props.data.layout as DisplayLayout, props.data.curves) : null),
    [props.data.curves, props.data.layout],
  );
  const grid = layout?.settings.grid;
  const widgets = layout?.settings.widgets ?? {};

  if (!grid) {
    return <div className="empty">No display grid is configured.</div>;
  }

  return (
    <section className="runtime-display">
      <div className="runtime-tool-strip">
        <button
          type="button"
          className={explorerOpen ? "active" : ""}
          onClick={() => setExplorerOpen((open) => !open)}
        >
          <Database size={14} strokeWidth={2.1} />
          Explorer
        </button>
      </div>
      <div
        className="runtime-grid"
        style={{
          gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
          gridAutoRows: `${grid.rowHeight}px`,
        }}
      >
        {grid.items.map((item) => {
          const widget = widgets[item.widgetId];
          if (!widget) return null;
          return (
            <section
              key={item.widgetId}
              className={`runtime-widget runtime-widget-${widget.type}`}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
              }}
            >
              {renderRuntimeWidget(item.widgetId, widget, props)}
            </section>
          );
        })}
      </div>
      {explorerOpen && <BoreholeExplorer data={props.data} onClose={() => setExplorerOpen(false)} />}
    </section>
  );
}
