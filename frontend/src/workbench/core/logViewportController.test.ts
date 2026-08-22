import { describe, expect, it } from "vitest";

import {
  defaultLogViewportControllerState,
  resolveLogViewportController,
  resetLogViewportController,
  scrollLogViewportController,
  zoomLogViewportControllerAtDepth,
  zoomLogViewportControllerToDepthWindow,
  type LogViewportControllerConfig,
} from "./logViewportController";

const CONFIG: LogViewportControllerConfig = {
  depthDomain: { fromDepth: 0, toDepth: 604.3 },
  containerHeight: 640,
  headerHeight: 70,
  zoomEpsilon: 0.01,
};

describe("logViewportController", () => {
  it("starts at full virtual depth with no scroll", () => {
    const snapshot = resolveLogViewportController(CONFIG, defaultLogViewportControllerState(CONFIG));

    expect(snapshot.viewport.depthDomain).toEqual(CONFIG.depthDomain);
    expect(snapshot.viewport.visibleDepthSpan.fromDepth).toBeCloseTo(0, 4);
    expect(snapshot.viewport.visibleDepthSpan.toDepth).toBeCloseTo(604.3, 4);
    expect(snapshot.viewport.maxScrollTop).toBe(0);
    expect(snapshot.isZoomed).toBe(false);
  });

  it("scrolling preserves zoom scale and visible window size", () => {
    const zoomed = zoomLogViewportControllerAtDepth(
      CONFIG,
      defaultLogViewportControllerState(CONFIG),
      300,
      4,
      120,
    );
    const topSpan = spanSize(zoomed.viewport.visibleDepthSpan);
    const middle = scrollLogViewportController(CONFIG, zoomed.state, zoomed.viewport.maxScrollTop / 2);
    const bottom = scrollLogViewportController(CONFIG, zoomed.state, zoomed.viewport.maxScrollTop);

    expect(middle.viewport.depthDomain).toEqual(CONFIG.depthDomain);
    expect(middle.viewport.pixelsPerDepth).toBeCloseTo(zoomed.viewport.pixelsPerDepth, 4);
    expect(spanSize(middle.viewport.visibleDepthSpan)).toBeCloseTo(topSpan, 3);
    expect(bottom.viewport.visibleDepthSpan.toDepth).toBeCloseTo(CONFIG.depthDomain.toDepth, 4);
  });

  it("rubber-band zoom pins the requested range and still reaches full virtual bottom", () => {
    const zoomed = zoomLogViewportControllerToDepthWindow(
      CONFIG,
      defaultLogViewportControllerState(CONFIG),
      120,
      160,
      0.05,
    );
    const bottom = scrollLogViewportController(CONFIG, zoomed.state, zoomed.viewport.maxScrollTop);

    expect(zoomed.viewport.depthDomain).toEqual(CONFIG.depthDomain);
    expect(zoomed.viewport.visibleDepthSpan.fromDepth).toBeCloseTo(120, 1);
    expect(spanSize(zoomed.viewport.visibleDepthSpan)).toBeLessThan(45);
    expect(bottom.viewport.visibleDepthSpan.toDepth).toBeCloseTo(CONFIG.depthDomain.toDepth, 4);
  });

  it("reset restores full depth after zoom and scroll", () => {
    const zoomed = zoomLogViewportControllerAtDepth(
      CONFIG,
      defaultLogViewportControllerState(CONFIG),
      300,
      4,
      120,
    );
    const scrolled = scrollLogViewportController(CONFIG, zoomed.state, zoomed.viewport.maxScrollTop);
    const reset = resetLogViewportController(CONFIG);

    expect(scrolled.isZoomed).toBe(true);
    expect(reset.isZoomed).toBe(false);
    expect(reset.viewport.visibleDepthSpan).toEqual(CONFIG.depthDomain);
    expect(reset.viewport.scrollTop).toBe(0);
  });

  it("clamps out-of-range scroll requests without changing virtual domain", () => {
    const zoomed = zoomLogViewportControllerAtDepth(
      CONFIG,
      defaultLogViewportControllerState(CONFIG),
      300,
      3,
    );

    const beyondBottom = scrollLogViewportController(CONFIG, zoomed.state, zoomed.viewport.maxScrollTop + 5000);
    const aboveTop = scrollLogViewportController(CONFIG, zoomed.state, -100);

    expect(beyondBottom.viewport.depthDomain).toEqual(CONFIG.depthDomain);
    expect(beyondBottom.viewport.scrollTop).toBe(zoomed.viewport.maxScrollTop);
    expect(aboveTop.viewport.scrollTop).toBe(0);
  });
});

function spanSize(span: { fromDepth: number; toDepth: number }) {
  return span.toDepth - span.fromDepth;
}
