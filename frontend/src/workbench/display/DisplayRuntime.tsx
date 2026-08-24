import { Database } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DisplayLayout, DisplayWidget } from "../../api/types";
import { BoreholeExplorer } from "../explorer/BoreholeExplorer";
import { normalizeDisplayLayout } from "./displayEditorModel";
import { renderRuntimeWidget } from "./runtime/runtimeWidgetRegistry";
import type { DisplayRuntimeProps } from "./runtime/runtimeTypes";

export function DisplayRuntime(props: DisplayRuntimeProps) {
  const [explorerOpen, setExplorerOpen] = useState(false);
  const normalizedLayout = useMemo(
    () => (props.data.layout ? normalizeDisplayLayout(props.data.layout as DisplayLayout, props.data.curves) : null),
    [props.data.curves, props.data.layout],
  );
  const [runtimeLayoutPreview, setRuntimeLayoutPreview] = useState<DisplayLayout | null>(null);
  const [runtimePreviewMessage, setRuntimePreviewMessage] = useState<string | null>(null);
  const [runtimePreviewWidgetIds, setRuntimePreviewWidgetIds] = useState<Set<string>>(() => new Set());
  const layout = runtimeLayoutPreview ?? normalizedLayout;
  const grid = layout?.settings.grid;
  const widgets = layout?.settings.widgets ?? {};

  useEffect(() => {
    setRuntimeLayoutPreview(null);
    setRuntimePreviewMessage(null);
    setRuntimePreviewWidgetIds(new Set());
  }, [props.data.id, props.data.layout]);

  const previewRuntimeWidget = (widgetId: string, widget: DisplayWidget, message: string) => {
    if (!normalizedLayout) return;
    setRuntimeLayoutPreview((current) => {
      const next = structuredClone(current ?? normalizedLayout);
      next.settings.widgets = { ...(next.settings.widgets ?? {}), [widgetId]: widget };
      return next;
    });
    setRuntimePreviewWidgetIds((current) => new Set([...current, widgetId]));
    setRuntimePreviewMessage(message);
  };

  const discardRuntimePreview = () => {
    setRuntimeLayoutPreview(null);
    setRuntimePreviewMessage(null);
    setRuntimePreviewWidgetIds(new Set());
  };

  if (!grid) {
    return <div className="empty">No display grid is configured.</div>;
  }

  return (
    <section className="runtime-display">
      <div className="runtime-tool-strip">
        {runtimeLayoutPreview && (
          <div className="runtime-preview-banner">
            <span>{runtimePreviewMessage ?? "Temporary display changes"}</span>
            <button
              type="button"
              disabled={props.runtimeLayoutSaving}
              onClick={() => props.onSaveRuntimeLayout?.(runtimeLayoutPreview)}
            >
              {props.runtimeLayoutSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              disabled={props.runtimeLayoutCloning}
              onClick={() => props.onCloneRuntimeLayout?.(runtimeLayoutPreview)}
            >
              {props.runtimeLayoutCloning ? "Saving copy..." : "Save as"}
            </button>
            <button type="button" onClick={discardRuntimePreview}>
              Discard
            </button>
          </div>
        )}
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
          const runtimeProps = {
            ...props,
            onPreviewRuntimeWidget: previewRuntimeWidget,
            onDiscardRuntimePreview: discardRuntimePreview,
            runtimePreviewWidgetIds,
          };
          return (
            <section
              key={item.widgetId}
              className={`runtime-widget runtime-widget-${widget.type}`}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
              }}
            >
              {renderRuntimeWidget(item.widgetId, widget, runtimeProps)}
            </section>
          );
        })}
      </div>
      {explorerOpen && <BoreholeExplorer data={props.data} onClose={() => setExplorerOpen(false)} />}
    </section>
  );
}
