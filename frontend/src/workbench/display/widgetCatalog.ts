import type { Curve, DisplayWidget } from "../../api/types";
import { defaultTracks } from "./trackCatalog";

export type WidgetCatalogItem = {
  type: string;
  label: string;
  icon: string;
  category: "geology" | "analytics" | "assistant" | "quality" | "data" | "export";
  description: string;
  defaultSize: { w: number; h: number };
  supportedSurfaces: Array<"dashboard" | "workbench" | "correlation" | "import" | "export">;
  dataRequirements?: string[];
  create: (availableCurves: Curve[], existingIds: Set<string>) => DisplayWidget;
};

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  {
    type: "singleValue",
    label: "Single Value",
    icon: "1V",
    category: "analytics",
    description: "Compact KPI such as depth, interval count, curve count, or corebox count.",
    defaultSize: { w: 2, h: 1 },
    supportedSurfaces: ["dashboard", "workbench"],
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
    category: "geology",
    description: "Depth-indexed borehole visualization with configurable tracks and curves.",
    defaultSize: { w: 7, h: 8 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["lithology_intervals", "curves"],
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
    category: "assistant",
    description: "Suggestion queue and assistant summary for central review.",
    defaultSize: { w: 3, h: 4 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["validation_issues", "ai_suggestions"],
    create: () => ({ type: "aiWorkflow", title: "AI Workflow", settings: { showSummary: true } }),
  },
  {
    type: "intervalDetails",
    label: "Interval Details",
    icon: "ID",
    category: "geology",
    description: "Selected-depth metadata, corebox preview, and geologist correction form.",
    defaultSize: { w: 3, h: 6 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["lithology_intervals"],
    create: () => ({ type: "intervalDetails", title: "Depth Metadata", settings: { editable: true } }),
  },
  {
    type: "curveCatalog",
    label: "Curve Catalog",
    icon: "CV",
    category: "data",
    description: "Curve metadata, coverage, units, and display settings summary.",
    defaultSize: { w: 3, h: 3 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["curves"],
    create: () => ({ type: "curveCatalog", title: "Curve Catalog", settings: { showCoverage: true } }),
  },
  {
    type: "validationPanel",
    label: "Validation",
    icon: "VA",
    category: "quality",
    description: "Validation counts and issue list.",
    defaultSize: { w: 2, h: 4 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["validation_issues"],
    create: () => ({ type: "validationPanel", title: "Validation", settings: { maxIssues: 8 } }),
  },
  {
    type: "interpretationQueue",
    label: "Interpretation Queue",
    icon: "IQ",
    category: "assistant",
    description: "Prioritized geologist action queue from validation, AI, curves, seams, metadata, and core evidence.",
    defaultSize: { w: 9, h: 3 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["validation_issues", "ai_suggestions", "lithology_intervals"],
    create: () => ({ type: "interpretationQueue", title: "Interpretation Queue", settings: { maxItems: 10 } }),
  },
  {
    type: "evidenceCoverage",
    label: "Evidence Coverage",
    icon: "EV",
    category: "quality",
    description: "Compact coverage map for lithology, curves, seams, core images, collar metadata, source audit, and correction state.",
    defaultSize: { w: 3, h: 3 },
    supportedSurfaces: ["workbench"],
    dataRequirements: ["lithology_intervals", "curves", "core_images", "source_files"],
    create: () => ({ type: "evidenceCoverage", title: "Evidence Coverage", settings: { compact: true } }),
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
