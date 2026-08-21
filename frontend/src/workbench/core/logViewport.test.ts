import { describe, expect, it } from "vitest";

import { addBottomDepthPadding } from "./depthDomain";
import {
  defaultPixelsPerDepth,
  resolveLogViewport,
  resolveLogPointerPosition,
  scrollTopForDepthAtViewportY,
  zoomViewportAtDepth,
  zoomViewportToDepthSpan,
} from "./logViewport";

const DEPTH_DOMAIN = { fromDepth: 0, toDepth: 604.3 };
const CONTAINER_HEIGHT = 640;
const HEADER_HEIGHT = 70;

describe("resolveLogViewport", () => {
  it("adds a small explicit bottom padding to the virtual domain", () => {
    const paddedDomain = addBottomDepthPadding(DEPTH_DOMAIN);

    expect(paddedDomain.fromDepth).toBe(DEPTH_DOMAIN.fromDepth);
    expect(paddedDomain.toDepth).toBeGreaterThan(DEPTH_DOMAIN.toDepth);
    expect(paddedDomain.toDepth - DEPTH_DOMAIN.toDepth).toBeLessThanOrEqual(5);
  });

  it("keeps the virtual depth domain stable in full-depth mode", () => {
    const pixelsPerDepth = defaultPixelsPerDepth(DEPTH_DOMAIN, CONTAINER_HEIGHT, HEADER_HEIGHT);
    const viewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth,
      scrollTop: 0,
    });

    expect(viewport.depthDomain).toEqual(DEPTH_DOMAIN);
    expect(viewport.visibleDepthSpan.fromDepth).toBeCloseTo(DEPTH_DOMAIN.fromDepth, 4);
    expect(viewport.visibleDepthSpan.toDepth).toBeCloseTo(DEPTH_DOMAIN.toDepth, 4);
    expect(viewport.maxScrollTop).toBe(0);
  });

  it("zooms into a smaller visible span without changing the virtual domain", () => {
    const viewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: 0,
      minPixelsPerDepth: 0.1,
    });

    expect(viewport.depthDomain).toEqual(DEPTH_DOMAIN);
    expect(viewport.visibleDepthSpan.fromDepth).toBeCloseTo(DEPTH_DOMAIN.fromDepth, 4);
    expect(viewport.visibleDepthSpan.toDepth).toBeLessThan(DEPTH_DOMAIN.toDepth);
    expect(viewport.maxScrollTop).toBeGreaterThan(0);
  });

  it("can scroll to the bottom of the same virtual domain while zoomed", () => {
    const topViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: 0,
      minPixelsPerDepth: 0.1,
    });
    const bottomViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: topViewport.maxScrollTop,
      minPixelsPerDepth: 0.1,
    });

    expect(bottomViewport.depthDomain).toEqual(DEPTH_DOMAIN);
    expect(bottomViewport.visibleDepthSpan.fromDepth).toBeGreaterThan(DEPTH_DOMAIN.fromDepth);
    expect(bottomViewport.visibleDepthSpan.toDepth).toBeCloseTo(DEPTH_DOMAIN.toDepth, 4);
  });

  it("keeps visible depth monotonic while scrolling through a zoomed domain", () => {
    const topViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: 0,
      minPixelsPerDepth: 0.1,
    });
    const middleViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: topViewport.maxScrollTop / 2,
      minPixelsPerDepth: 0.1,
    });
    const bottomViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: topViewport.maxScrollTop,
      minPixelsPerDepth: 0.1,
    });

    expect(topViewport.visibleDepthSpan.fromDepth).toBeLessThan(middleViewport.visibleDepthSpan.fromDepth);
    expect(middleViewport.visibleDepthSpan.fromDepth).toBeLessThan(bottomViewport.visibleDepthSpan.fromDepth);
    expect(topViewport.visibleDepthSpan.toDepth - topViewport.visibleDepthSpan.fromDepth).toBeCloseTo(
      middleViewport.visibleDepthSpan.toDepth - middleViewport.visibleDepthSpan.fromDepth,
      2,
    );
  });

  it("maps a selected depth to a scrollTop that preserves the pointer viewport y", () => {
    const viewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: 0,
      minPixelsPerDepth: 0.1,
    });
    const selectedDepth = 300;
    const viewportY = 120;
    const scrollTop = scrollTopForDepthAtViewportY(viewport.scale, selectedDepth, viewportY, viewport.maxScrollTop);
    const focusedViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop,
      minPixelsPerDepth: 0.1,
    });

    expect(focusedViewport.scale.depthToY(selectedDepth) - focusedViewport.scrollTop).toBeCloseTo(viewportY, 4);
  });

  it("resolves pointer depth from body coordinates while scrolled", () => {
    const viewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: 320,
      minPixelsPerDepth: 0.1,
    });
    const bodyTop = 100 - viewport.scrollTop;
    const pointer = resolveLogPointerPosition(viewport, 220, bodyTop);

    expect(pointer.contentY).toBeCloseTo(440, 4);
    expect(pointer.viewportBodyY).toBeCloseTo(120, 4);
    expect(pointer.depth).toBeCloseTo(viewport.scale.yToDepth(440), 4);
  });

  it("clamps pointer depth to the drawable body range", () => {
    const viewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: 4,
      scrollTop: 0,
      minPixelsPerDepth: 0.1,
    });
    const above = resolveLogPointerPosition(viewport, 50, 100);
    const below = resolveLogPointerPosition(viewport, 5000, 100);

    expect(above.contentY).toBe(0);
    expect(above.depth).toBeCloseTo(DEPTH_DOMAIN.fromDepth, 4);
    expect(below.contentY).toBe(viewport.scale.drawableHeight);
    expect(below.depth).toBeCloseTo(DEPTH_DOMAIN.toDepth, 4);
  });

  it("zooms around a pointer depth without changing the virtual domain", () => {
    const transition = zoomViewportAtDepth(
      {
        depthDomain: DEPTH_DOMAIN,
        containerHeight: CONTAINER_HEIGHT,
        headerHeight: HEADER_HEIGHT,
        pixelsPerDepth: 1,
        scrollTop: 0,
        minPixelsPerDepth: 0.1,
      },
      250,
      2,
      180,
    );

    expect(transition.viewport.depthDomain).toEqual(DEPTH_DOMAIN);
    expect(transition.pixelsPerDepth).toBe(2);
    expect(transition.viewport.scale.depthToY(250) - transition.scrollTop).toBeCloseTo(180, 4);
  });

  it("rubber-band zoom creates a smaller visible span and preserves bottom scroll reach", () => {
    const transition = zoomViewportToDepthSpan(
      {
        depthDomain: DEPTH_DOMAIN,
        containerHeight: CONTAINER_HEIGHT,
        headerHeight: HEADER_HEIGHT,
        pixelsPerDepth: 1,
        scrollTop: 0,
        minPixelsPerDepth: 0.1,
      },
      120,
      160,
    );
    const bottomViewport = resolveLogViewport({
      depthDomain: DEPTH_DOMAIN,
      containerHeight: CONTAINER_HEIGHT,
      headerHeight: HEADER_HEIGHT,
      pixelsPerDepth: transition.pixelsPerDepth,
      scrollTop: transition.viewport.maxScrollTop,
      minPixelsPerDepth: 0.1,
    });

    expect(transition.viewport.depthDomain).toEqual(DEPTH_DOMAIN);
    expect(transition.viewport.visibleDepthSpan.toDepth - transition.viewport.visibleDepthSpan.fromDepth).toBeLessThan(DEPTH_DOMAIN.toDepth - DEPTH_DOMAIN.fromDepth);
    expect(bottomViewport.visibleDepthSpan.toDepth).toBeCloseTo(DEPTH_DOMAIN.toDepth, 4);
  });
});
