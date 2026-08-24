import { describe, expect, it } from "vitest";

import {
  createLogWidgetControlPlane,
  defaultLogWidgetControlPlaneState,
  type LogWidgetControlPlaneConfig,
} from "./logWidgetControlPlane";

const CONFIG: LogWidgetControlPlaneConfig = {
  depthDomain: { fromDepth: 0, toDepth: 604.3 },
  containerHeight: 640,
  headerHeight: 70,
  zoomEpsilon: 0.01,
};

describe("logWidgetControlPlane", () => {
  it("keeps virtual depth intact through zoom and bottom scroll", () => {
    const full = createLogWidgetControlPlane(CONFIG, defaultLogWidgetControlPlaneState(CONFIG));
    const zoomed = full.zoomAtDepth(300, 4, 120);
    const zoomedPlane = createLogWidgetControlPlane(CONFIG, zoomed.state);
    const bottom = zoomedPlane.scrollTo(zoomedPlane.snapshot.viewport.maxScrollTop);
    const bottomPlane = createLogWidgetControlPlane(CONFIG, bottom.state);

    expect(zoomedPlane.virtualDepth).toEqual(CONFIG.depthDomain);
    expect(bottomPlane.virtualDepth).toEqual(CONFIG.depthDomain);
    expect(bottomPlane.visibleDepth.toDepth).toBeCloseTo(CONFIG.depthDomain.toDepth, 4);
  });

  it("scroll changes visible start but preserves visible span at the same zoom", () => {
    const full = createLogWidgetControlPlane(CONFIG, defaultLogWidgetControlPlaneState(CONFIG));
    const zoomed = createLogWidgetControlPlane(CONFIG, full.zoomAtDepth(300, 4, 120).state);
    const top = createLogWidgetControlPlane(CONFIG, zoomed.scrollTo(0).state);
    const bottom = createLogWidgetControlPlane(CONFIG, zoomed.scrollTo(zoomed.snapshot.viewport.maxScrollTop).state);
    const topSpan = top.visibleDepth.toDepth - top.visibleDepth.fromDepth;

    expect(bottom.visibleDepth.fromDepth).toBeGreaterThan(top.visibleDepth.fromDepth);
    expect(bottom.visibleDepth.toDepth - bottom.visibleDepth.fromDepth).toBeCloseTo(topSpan, 3);
    expect(bottom.snapshot.viewport.pixelsPerDepth).toBeCloseTo(top.snapshot.viewport.pixelsPerDepth, 4);
  });

  it("round-trips depth through body coordinates", () => {
    const plane = createLogWidgetControlPlane(CONFIG, defaultLogWidgetControlPlaneState(CONFIG));

    expect(plane.roundTripDepth(0)).toBeCloseTo(0, 4);
    expect(plane.roundTripDepth(250.25)).toBeCloseTo(250.25, 4);
    expect(plane.roundTripDepth(604.3)).toBeCloseTo(604.3, 4);
  });

  it("resolves pointer depth from track body bounds and excludes header pixels", () => {
    const full = createLogWidgetControlPlane(CONFIG, defaultLogWidgetControlPlaneState(CONFIG));
    const zoomed = createLogWidgetControlPlane(CONFIG, full.zoomAtDepth(300, 4, 120).state);
    const bodyTop = 100 - zoomed.snapshot.viewport.scrollTop;
    const pointer = zoomed.resolvePointer(250, 220, { left: 50, top: bodyTop });

    expect(pointer.localX).toBe(200);
    expect(pointer.bodyY).toBeCloseTo(zoomed.snapshot.viewport.scrollTop + 120, 4);
    expect(pointer.viewportY).toBeCloseTo(120, 4);
    expect(zoomed.depthToViewportY(pointer.depth)).toBeCloseTo(120, 4);
  });

  it("rubber-band zoom narrows visible depth while preserving full virtual bottom reach", () => {
    const full = createLogWidgetControlPlane(CONFIG, defaultLogWidgetControlPlaneState(CONFIG));
    const zoomed = createLogWidgetControlPlane(CONFIG, full.zoomToDepthWindow(120, 160, 0.05).state);
    const bottom = createLogWidgetControlPlane(CONFIG, zoomed.scrollTo(zoomed.snapshot.viewport.maxScrollTop).state);

    expect(zoomed.virtualDepth).toEqual(CONFIG.depthDomain);
    expect(zoomed.visibleDepth.fromDepth).toBeCloseTo(120, 1);
    expect(zoomed.visibleDepth.toDepth - zoomed.visibleDepth.fromDepth).toBeLessThan(45);
    expect(bottom.visibleDepth.toDepth).toBeCloseTo(CONFIG.depthDomain.toDepth, 4);
  });
});
