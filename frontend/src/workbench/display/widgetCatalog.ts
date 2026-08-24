import type { Curve, DisplayWidget } from "../../api/types";
import { defaultTracks } from "./trackCatalog";

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
  {
    type: "interpretationQueue",
    label: "Interpretation Queue",
    icon: "IQ",
    description: "Prioritized geologist action queue from validation, AI, curves, seams, metadata, and core evidence.",
    create: () => ({ type: "interpretationQueue", title: "Interpretation Queue", settings: { maxItems: 10 } }),
  },
];

export function createCatalogWidget(type: string, availableCurves: Curve[]) {
  return WIDGET_CATALOG.find((item) => item.type === type)!.create(availableCurves, new Set());
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

export function widgetLabel(widget: DisplayWidget) {
  if (widget.type === "singleValue") return `${widget.title} (${widget.metric ?? "metric"})`;
  return widget.title;
}
