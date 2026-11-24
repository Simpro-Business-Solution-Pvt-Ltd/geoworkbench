// Zoom maths for the Correlation display. The display draws every interval, curve and
// tie line as a percentage of the log height, so zooming = making that height taller
// (zoom × the base view height) and scrolling.

export const MIN_ZOOM = 1;
/** 60× turns ~0.8 px/m at full depth into ~45 px/m, enough to read sub-metre seams. */
export const MAX_ZOOM = 60;
export const ZOOM_STEP = 1.5;
/** Drags shorter than this (px) are treated as clicks, not zoom selections. */
export const MIN_DRAG_PIXELS = 8;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function stepZoom(zoom: number, direction: "in" | "out"): number {
  return clampZoom(direction === "in" ? zoom * ZOOM_STEP : zoom / ZOOM_STEP);
}

/**
 * Zoom that makes the dragged band (fractions of the log height, 0 = top) fill the view.
 * logHeight is the current on-screen log height in px; viewHeight the visible panel height.
 */
export function zoomForSelection(
  zoom: number,
  fromFraction: number,
  toFraction: number,
  logHeight: number,
  viewHeight: number,
): number {
  const span = Math.abs(toFraction - fromFraction);
  if (span <= 0 || logHeight <= 0 || viewHeight <= 0) return clampZoom(zoom);
  const selectedPixels = span * logHeight;
  return clampZoom(zoom * (viewHeight / selectedPixels));
}

/** Depth-axis tick spacing (m): finer as the zoom shows a shorter span per screen. */
export function axisTickStep(span: number, zoom: number): number {
  const visibleSpan = Math.max(1, span) / clampZoom(zoom);
  if (visibleSpan > 600) return 100;
  if (visibleSpan > 280) return 50;
  if (visibleSpan > 120) return 25;
  if (visibleSpan > 50) return 10;
  if (visibleSpan > 20) return 5;
  if (visibleSpan > 8) return 2;
  return 1;
}

export function formatZoom(zoom: number): string {
  const value = zoom < 10 ? Math.round(zoom * 10) / 10 : Math.round(zoom);
  return `${value}×`;
}

/** Fraction (0-1) of the log height under a screen y, clamped to the log. */
export function fractionAt(clientY: number, logTop: number, logHeight: number): number {
  if (logHeight <= 0) return 0;
  return Math.min(1, Math.max(0, (clientY - logTop) / logHeight));
}
