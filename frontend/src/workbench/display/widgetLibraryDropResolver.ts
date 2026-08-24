import type { Curve, DisplayLayout } from "../../api/types";
import { defaultGridItem } from "./displayEditorModel";
import { clampGridItem } from "./editor/displayGridUtils";
import { createWidgetId, WIDGET_CATALOG } from "./widgetCatalog";

export const WIDGET_LIBRARY_DRAG_MIME_TYPE = "application/geoworkbench-widget-library";

export type WidgetLibraryDragPayload = {
  scope: "widgetLibrary";
  kind: "widget";
  widgetType: string;
};

export type WidgetDropPlacement = {
  x?: number;
  y?: number;
};

export type WidgetLibraryDropResult =
  | { status: "changed"; layout: DisplayLayout; widgetId: string; message: string }
  | { status: "ignored"; layout: DisplayLayout; message: string };

export function createWidgetLibraryDragPayload(widgetType: string): WidgetLibraryDragPayload {
  return { scope: "widgetLibrary", kind: "widget", widgetType };
}

export function resolveWidgetLibraryDrop(
  layout: DisplayLayout,
  payload: WidgetLibraryDragPayload,
  availableCurves: Curve[],
  placement: WidgetDropPlacement = {},
): WidgetLibraryDropResult {
  if (payload.scope !== "widgetLibrary" || payload.kind !== "widget") {
    return { status: "ignored", layout, message: "Dropped item is not a widget library item." };
  }
  const catalogItem = WIDGET_CATALOG.find((item) => item.type === payload.widgetType);
  if (!catalogItem) {
    return { status: "ignored", layout, message: `No widget catalog item exists for ${payload.widgetType}.` };
  }

  const next = structuredClone(layout);
  next.settings.widgets = next.settings.widgets ?? {};
  next.settings.grid = next.settings.grid ?? {
    columns: 12,
    rowHeight: 72,
    items: [],
  };
  const existingIds = new Set(Object.keys(next.settings.widgets));
  const widgetId = createWidgetId(catalogItem.type, existingIds);
  next.settings.widgets[widgetId] = catalogItem.create(availableCurves, existingIds);
  const fallbackItem = defaultGridItem(widgetId, next.settings.grid.items.length);
  next.settings.grid.items.push(
    clampGridItem(
      {
        ...fallbackItem,
        x: placement.x ?? fallbackItem.x,
        y: placement.y ?? fallbackItem.y,
        w: catalogItem.defaultSize.w,
        h: catalogItem.defaultSize.h,
      },
      next.settings.grid.columns,
    ),
  );

  return {
    status: "changed",
    layout: next,
    widgetId,
    message: `${catalogItem.label} widget added.`,
  };
}
