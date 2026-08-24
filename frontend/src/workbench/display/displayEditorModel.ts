import type { Curve, DisplayGridItem, DisplayLayout, DisplayWidget } from "../../api/types";
import { defaultTracks, syncTrackCurves } from "./trackCatalog";
import { createCatalogWidget } from "./widgetCatalog";

const CURRENT_DISPLAY_SCHEMA_VERSION = 3;
const V3_DEFAULT_TRACK_IDS = new Set(["core-images", "recovery", "rqd", "ai-suggestions"]);

export function normalizeDisplayLayout(layout: DisplayLayout, availableCurves: Curve[]): DisplayLayout {
  const draft = structuredClone(layout);
  const sourceSchemaVersion = draft.settings.schemaVersion ?? 1;
  draft.settings.schemaVersion = CURRENT_DISPLAY_SCHEMA_VERSION;
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
  if (sourceSchemaVersion < CURRENT_DISPLAY_SCHEMA_VERSION) {
    draft.settings.widgets["log-widget"].tracks = migrateLogWidgetTracks(
      draft.settings.widgets["log-widget"].tracks,
      availableCurves,
    );
  }
  for (const [widgetId, widget] of Object.entries(draft.settings.widgets)) {
    if (widget.type === "dataArrival") {
      delete draft.settings.widgets[widgetId];
    }
    if (widget.type === "exportPanel") {
      delete draft.settings.widgets[widgetId];
    }
  }
  if (!draft.settings.widgets["correction-progress"]) {
    draft.settings.widgets["correction-progress"] = {
      type: "singleValue",
      title: "Correction Progress",
      metric: "corrected_interval_percent",
    };
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

function migrateLogWidgetTracks(tracks: DisplayWidget["tracks"], availableCurves: Curve[]): NonNullable<DisplayWidget["tracks"]> {
  const next = [...(tracks ?? [])];
  const existingIds = new Set(next.map((track) => track.id));
  for (const track of defaultTracks(availableCurves)) {
    if (!V3_DEFAULT_TRACK_IDS.has(track.id) || existingIds.has(track.id)) continue;
    next.push(track);
    existingIds.add(track.id);
  }
  return next;
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
    "correction-progress": {
      type: "singleValue",
      title: "Correction Progress",
      metric: "corrected_interval_percent",
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
    { widgetId: "correction-progress", x: 10, y: 0, w: 2, h: 1 },
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
