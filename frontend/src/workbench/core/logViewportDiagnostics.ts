import type { LogViewportState } from "./logViewport";

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
