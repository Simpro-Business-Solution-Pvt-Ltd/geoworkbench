import type { Curve, DisplayGridItem, DisplayLayout, DisplayTrack, DisplayWidget } from "../../api/types";
import { defaultTracks, syncTrackCurves } from "./trackCatalog";

export type WidgetCatalogItem = {
  type: string;
  label: string;
  icon: string;
  description: string;
  create: (availableCurves: Curve[], existingIds: Set<string>) => DisplayWidget;
};

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  {
    type: "singleValue",
    label: "Single Value",
    icon: "1V",
    description: "Compact KPI such as depth, interval count, curve count, or corebox count.",
    create: () => ({
      type: "singleValue",
      title: "Total Depth",
      metric: "total_depth",
      settings: { unit: "m" },
    }),
  },
  {
    type: "logWidget",
    label: "Log Widget",
    icon: "LG",
    description: "Depth-indexed borehole visualization with configurable tracks and curves.",
    create: (availableCurves) => ({
      type: "logWidget",
      title: "Borehole Log",
      tracks: defaultTracks(availableCurves),
      settings: { virtualRange: "full-depth", visibleRange: "interactive" },
    }),
  },
  {
    type: "aiWorkflow",
    label: "AI Workflow",
    icon: "AI",
    description: "Suggestion queue and assistant summary for central review.",
    create: () => ({ type: "aiWorkflow", title: "AI Workflow", settings: { showSummary: true } }),
  },
  {
    type: "intervalDetails",
    label: "Interval Details",
    icon: "ID",
    description: "Selected-depth metadata, corebox preview, and geologist correction form.",
    create: () => ({ type: "intervalDetails", title: "Depth Metadata", settings: { editable: true } }),
  },
  {
    type: "curveCatalog",
    label: "Curve Catalog",
    icon: "CV",
    description: "Curve metadata, coverage, units, and display settings summary.",
    create: () => ({ type: "curveCatalog", title: "Curve Catalog", settings: { showCoverage: true } }),
  },
  {
    type: "validationPanel",
    label: "Validation",
    icon: "VA",
    description: "Validation counts and issue list.",
    create: () => ({ type: "validationPanel", title: "Validation", settings: { maxIssues: 8 } }),
  },
];

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
    right: ["interval-details", "export-panel"],
  };
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

export function createWidgetId(type: string, existingIds: Set<string>) {
  const base = type.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`).replace(/^-/, "");
  let index = 1;
  let id = base;
  while (existingIds.has(id)) {
    index += 1;
    id = `${base}-${index}`;
  }
  return id;
}

function createCatalogWidget(type: string, availableCurves: Curve[]) {
  return WIDGET_CATALOG.find((item) => item.type === type)!.create(availableCurves, new Set());
}

function defaultGridItems(widgetIds: string[]) {
  return widgetIds.map((widgetId, index) => defaultGridItem(widgetId, index));
}

export function defaultGridItem(widgetId: string, index: number): DisplayGridItem {
  if (widgetId === "log-widget") {
    return { widgetId, x: 3, y: 0, w: 6, h: 8 };
  }
  return { widgetId, x: (index % 3) * 4, y: Math.floor(index / 3) * 3, w: 3, h: 2 };
}

export function widgetLabel(widget: DisplayWidget) {
  if (widget.type === "singleValue") return `${widget.title} (${widget.metric ?? "metric"})`;
  return widget.title;
}
