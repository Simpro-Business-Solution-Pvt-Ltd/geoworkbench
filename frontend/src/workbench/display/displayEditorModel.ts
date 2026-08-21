import type { Curve, DisplayGridItem, DisplayLayout, DisplayWidget } from "../../api/types";
import { defaultTracks, syncTrackCurves } from "./trackCatalog";
import { createCatalogWidget } from "./widgetCatalog";

export function normalizeDisplayLayout(layout: DisplayLayout, availableCurves: Curve[]): DisplayLayout {
  const draft = structuredClone(layout);
  draft.settings.schemaVersion = draft.settings.schemaVersion ?? 2;
  draft.settings.mode = draft.settings.mode ?? "runtime";
  draft.settings.widgets = draft.settings.widgets ?? {};
  if (!draft.settings.grid) {
    draft.settings.widgets = {
      ...defaultRuntimeWidgets(availableCurves),
      ...draft.settings.widgets,
    };
  } else if (!draft.settings.widgets["log-widget"]) {
    draft.settings.widgets["log-widget"] = createCatalogWidget("logWidget", availableCurves);
  }
  draft.settings.widgets["log-widget"].tracks =
    draft.settings.widgets["log-widget"].tracks ?? defaultTracks(availableCurves);
  for (const [widgetId, widget] of Object.entries(draft.settings.widgets)) {
    if (widget.type === "dataArrival") {
      delete draft.settings.widgets[widgetId];
    }
    if (widget.type === "exportPanel") {
      delete draft.settings.widgets[widgetId];
    }
  }
  draft.settings.widgets["log-widget"].tracks = syncTrackCurves(
    draft.settings.widgets["log-widget"].tracks,
    availableCurves,
  ).map((track) => (track.type === "images" ? { ...track, width: Math.max(track.width, 150) } : track));
  draft.settings.regions = draft.settings.regions ?? {
    left: ["validation-panel", "ai-workflow"],
    center: ["log-widget"],
    right: ["interval-details", "curve-catalog"],
  };
  draft.settings.regions = pruneRegions(draft.settings.regions, new Set(Object.keys(draft.settings.widgets)));
  draft.settings.grid = draft.settings.grid ?? {
    columns: 12,
    rowHeight: 72,
    items: defaultRuntimeGridItems(),
  };
  const gridIds = new Set(draft.settings.grid.items.map((item) => item.widgetId));
  for (const widgetId of Object.keys(draft.settings.widgets)) {
    if (!gridIds.has(widgetId)) {
      draft.settings.grid.items.push(defaultGridItem(widgetId, draft.settings.grid.items.length));
    }
  }
  draft.settings.grid.items = draft.settings.grid.items.filter(
    (item) => Boolean(draft.settings.widgets?.[item.widgetId]),
  );
  return draft;
}

export function defaultRuntimeWidgets(availableCurves: Curve[]): Record<string, DisplayWidget> {
  return {
    "total-depth": {
      type: "singleValue",
      title: "Total Depth",
      metric: "total_depth",
      settings: { unit: "m" },
    },
    "interval-count": {
      type: "singleValue",
      title: "Intervals",
      metric: "interval_count",
    },
    "curve-count": {
      type: "singleValue",
      title: "Curves",
      metric: "curve_count",
    },
    "curve-coverage": {
      type: "singleValue",
      title: "Curve Coverage",
      metric: "curve_coverage_percent",
    },
    "corebox-count": {
      type: "singleValue",
      title: "Coreboxes",
      metric: "corebox_count",
    },
    "validation-panel": createCatalogWidget("validationPanel", availableCurves),
    "ai-workflow": createCatalogWidget("aiWorkflow", availableCurves),
    "log-widget": createCatalogWidget("logWidget", availableCurves),
    "interval-details": createCatalogWidget("intervalDetails", availableCurves),
    "curve-catalog": createCatalogWidget("curveCatalog", availableCurves),
  };
}

export function defaultRuntimeGridItems(): DisplayGridItem[] {
  return [
    { widgetId: "total-depth", x: 0, y: 0, w: 2, h: 1 },
    { widgetId: "interval-count", x: 2, y: 0, w: 2, h: 1 },
    { widgetId: "curve-count", x: 4, y: 0, w: 2, h: 1 },
    { widgetId: "corebox-count", x: 6, y: 0, w: 2, h: 1 },
    { widgetId: "curve-coverage", x: 8, y: 0, w: 2, h: 1 },
    { widgetId: "validation-panel", x: 0, y: 1, w: 2, h: 4 },
    { widgetId: "ai-workflow", x: 0, y: 5, w: 2, h: 4 },
    { widgetId: "log-widget", x: 2, y: 1, w: 7, h: 8 },
    { widgetId: "interval-details", x: 9, y: 1, w: 3, h: 6 },
    { widgetId: "curve-catalog", x: 9, y: 7, w: 3, h: 3 },
  ];
}

export function defaultGridItem(widgetId: string, index: number): DisplayGridItem {
  if (widgetId === "log-widget") {
    return { widgetId, x: 3, y: 0, w: 6, h: 8 };
  }
  return { widgetId, x: (index % 3) * 4, y: Math.floor(index / 3) * 3, w: 3, h: 2 };
}

function pruneRegions(regions: Record<string, string[]>, widgetIds: Set<string>) {
  return Object.fromEntries(
    Object.entries(regions).map(([region, ids]) => [region, ids.filter((widgetId) => widgetIds.has(widgetId))]),
  );
}
