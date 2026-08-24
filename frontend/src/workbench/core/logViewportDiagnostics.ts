import type { LogViewportState } from "./logViewport";
import type { LogWidgetInvariantSnapshot } from "./logWidgetControlPlane";

export type LogViewportDiagnosticItem = {
  key: string;
  label: string;
  value: string;
};

export function buildLogViewportDiagnostics(viewport: LogViewportState): LogViewportDiagnosticItem[] {
  return [
    diagnostic("virtualRange", "Virtual", `${formatDepth(viewport.depthDomain.fromDepth)}-${formatDepth(viewport.depthDomain.toDepth)} m`),
    diagnostic("visibleRange", "Visible", `${formatDepth(viewport.visibleDepthSpan.fromDepth)}-${formatDepth(viewport.visibleDepthSpan.toDepth)} m`),
    diagnostic("scroll", "Scroll", `${formatPixels(viewport.scrollTop)} / ${formatPixels(viewport.maxScrollTop)} px`),
    diagnostic("body", "Body", `${formatPixels(viewport.visibleBodyHeight)} / ${formatPixels(viewport.bodyHeight)} px`),
    diagnostic("scale", "Scale", `${formatNumber(viewport.pixelsPerDepth)} px/m`),
    diagnostic("domainSpan", "Domain span", `${formatDepth(viewport.scale.domainSpan)} m`),
  ];
}

export function buildLogWidgetControlPlaneDiagnostics(
  snapshot: LogWidgetInvariantSnapshot,
): LogViewportDiagnosticItem[] {
  return [
    diagnostic("virtualRange", "Virtual", `${formatDepth(snapshot.virtualFromDepth)}-${formatDepth(snapshot.virtualToDepth)} m`),
    diagnostic("visibleRange", "Visible", `${formatDepth(snapshot.visibleFromDepth)}-${formatDepth(snapshot.visibleToDepth)} m`),
    diagnostic("visibleSpan", "Visible span", `${formatDepth(snapshot.visibleSpan)} m`),
    diagnostic("scroll", "Scroll", `${formatPixels(snapshot.scrollTop)} / ${formatPixels(snapshot.maxScrollTop)} px`),
    diagnostic("body", "Body", `${formatPixels(snapshot.visibleBodyHeight)} / ${formatPixels(snapshot.bodyHeight)} px`),
    diagnostic("header", "Header", `${formatPixels(snapshot.headerHeight)} px`),
    diagnostic("scale", "Scale", `${formatNumber(snapshot.pixelsPerDepth)} px/m`),
  ];
}

function diagnostic(key: string, label: string, value: string): LogViewportDiagnosticItem {
  return { key, label, value };
}

function formatDepth(value: number) {
  return formatNumber(value, value >= 100 ? 1 : 2);
}

function formatPixels(value: number) {
  return formatNumber(value, value >= 100 ? 0 : 1);
}

function formatNumber(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}
