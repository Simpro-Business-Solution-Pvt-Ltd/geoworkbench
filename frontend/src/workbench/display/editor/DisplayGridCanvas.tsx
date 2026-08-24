import { useRef, useState } from "react";
import GridLayout from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import type { DisplayGridItem, DisplayLayout, DisplayWidget } from "../../../api/types";
import { WIDGET_LIBRARY_DRAG_MIME_TYPE, type WidgetDropPlacement } from "../widgetLibraryDropResolver";
import { widgetLabel } from "../widgetCatalog";
import { commitGridLayout, toReactGridLayout } from "./displayGridUtils";
import { useElementWidth } from "./useElementWidth";

type Props = {
  draft: DisplayLayout;
  gridItems: DisplayGridItem[];
  widgets: Record<string, DisplayWidget>;
  selectedWidgetId: string;
  saving: boolean;
  setHistory: React.Dispatch<React.SetStateAction<DisplayLayout[]>>;
  setDraft: React.Dispatch<React.SetStateAction<DisplayLayout | null>>;
  onSelectWidget: (widgetId: string) => void;
  onOpenWidgetSettings: (widgetId: string) => void;
  onDropWidget: (widgetType: string, placement: WidgetDropPlacement) => void;
};

export function DisplayGridCanvas({
  draft,
  gridItems,
  widgets,
  selectedWidgetId,
  saving,
  setHistory,
  setDraft,
  onSelectWidget,
  onOpenWidgetSettings,
  onDropWidget,
}: Props) {
  const [layoutInteractionSnapshot, setLayoutInteractionSnapshot] = useState<DisplayLayout | null>(null);
  const canvasPanelRef = useRef<HTMLElement | null>(null);
  const canvasWidth = useElementWidth(canvasPanelRef, 960);

  const resolveDropPlacement = (clientX: number, clientY: number): WidgetDropPlacement => {
    const bounds = canvasPanelRef.current?.querySelector<HTMLElement>(".display-grid-canvas")?.getBoundingClientRect();
    if (!bounds) return {};
    const columns = draft.settings.grid?.columns ?? 12;
    const rowHeight = draft.settings.grid?.rowHeight ?? 72;
    const cellWidth = bounds.width / columns;
    return {
      x: Math.max(0, Math.min(columns - 1, Math.floor((clientX - bounds.left) / cellWidth))),
      y: Math.max(0, Math.floor((clientY - bounds.top) / rowHeight)),
    };
  };

  return (
    <section
      ref={canvasPanelRef}
      className="display-canvas-panel"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(WIDGET_LIBRARY_DRAG_MIME_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        const rawPayload = event.dataTransfer.getData(WIDGET_LIBRARY_DRAG_MIME_TYPE);
        if (!rawPayload) return;
        event.preventDefault();
        const payload = JSON.parse(rawPayload) as { widgetType?: string };
        if (payload.widgetType) onDropWidget(payload.widgetType, resolveDropPlacement(event.clientX, event.clientY));
      }}
    >
      <GridLayout
        className="display-grid-canvas"
        cols={draft.settings.grid?.columns ?? 12}
        rowHeight={draft.settings.grid?.rowHeight ?? 72}
        width={Math.max(720, canvasWidth - 28)}
        margin={[8, 8]}
        containerPadding={[0, 0]}
        compactType={null}
        preventCollision={false}
        isDraggable={!saving}
        isResizable={!saving}
        draggableHandle=".display-widget-drag-handle"
        layout={toReactGridLayout(gridItems)}
        onDragStart={(_, _oldItem, item) => {
          setLayoutInteractionSnapshot(structuredClone(draft));
          if (item) onSelectWidget(item.i);
        }}
        onResizeStart={(_, _oldItem, item) => {
          setLayoutInteractionSnapshot(structuredClone(draft));
          if (item) onSelectWidget(item.i);
        }}
        onDragStop={(nextLayout) => {
          commitGridLayout([...nextLayout], layoutInteractionSnapshot, setHistory, setDraft);
          setLayoutInteractionSnapshot(null);
        }}
        onResizeStop={(nextLayout) => {
          commitGridLayout([...nextLayout], layoutInteractionSnapshot, setHistory, setDraft);
          setLayoutInteractionSnapshot(null);
        }}
      >
        {gridItems.map((item) => {
          const widget = widgets[item.widgetId];
          if (!widget) return null;
          return (
            <div
              key={item.widgetId}
              role="button"
              tabIndex={0}
              className={`display-widget-tile ${selectedWidgetId === item.widgetId ? "selected" : ""}`}
              onClick={() => onSelectWidget(item.widgetId)}
              onContextMenu={(event) => {
                event.preventDefault();
                onSelectWidget(item.widgetId);
                onOpenWidgetSettings(item.widgetId);
              }}
            >
              <span className="display-widget-drag-handle">{widget.type}</span>
              <strong>{widgetLabel(widget)}</strong>
              <small>
                x{item.x} y{item.y} w{item.w} h{item.h}
              </small>
            </div>
          );
        })}
      </GridLayout>
    </section>
  );
}
