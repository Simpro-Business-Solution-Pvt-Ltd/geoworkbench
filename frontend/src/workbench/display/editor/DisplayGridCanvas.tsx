import { useRef, useState } from "react";
import GridLayout from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import type { DisplayGridItem, DisplayLayout, DisplayWidget } from "../../../api/types";
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
}: Props) {
  const [layoutInteractionSnapshot, setLayoutInteractionSnapshot] = useState<DisplayLayout | null>(null);
  const canvasPanelRef = useRef<HTMLElement | null>(null);
  const canvasWidth = useElementWidth(canvasPanelRef, 960);

  return (
    <section ref={canvasPanelRef} className="display-canvas-panel">
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
