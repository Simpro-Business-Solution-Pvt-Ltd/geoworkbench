import { describe, expect, it } from "vitest";

import {
  MAX_ZOOM,
  axisTickStep,
  clampZoom,
  formatZoom,
  fractionAt,
  stepZoom,
  zoomForSelection,
} from "./correlationZoomModel";

describe("correlation zoom", () => {
  it("clamps zoom to the allowed range", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(500)).toBe(MAX_ZOOM);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("steps in and out and never below full depth", () => {
    expect(stepZoom(1, "in")).toBe(1.5);
    expect(stepZoom(1.5, "out")).toBe(1);
    expect(stepZoom(1, "out")).toBe(1);
  });

  it("makes a dragged band fill the view", () => {
    // 600 px log at 1x, drag over 10% (60 px), 600 px view -> 10x.
    expect(zoomForSelection(1, 0.4, 0.5, 600, 600)).toBeCloseTo(10);
    // Dragging upwards gives the same result.
    expect(zoomForSelection(1, 0.5, 0.4, 600, 600)).toBeCloseTo(10);
    // A tiny band is capped at the maximum zoom.
    expect(zoomForSelection(1, 0.5, 0.5001, 600, 600)).toBe(MAX_ZOOM);
    // No band keeps the current zoom.
    expect(zoomForSelection(3, 0.5, 0.5, 600, 600)).toBe(3);
  });

  it("uses finer depth ticks when zoomed", () => {
    expect(axisTickStep(800, 1)).toBe(100);
    expect(axisTickStep(800, 4)).toBe(25);
    expect(axisTickStep(800, 20)).toBe(5);
    expect(axisTickStep(800, 60)).toBe(2);
  });

  it("formats the zoom level", () => {
    expect(formatZoom(1)).toBe("1×");
    expect(formatZoom(2.25)).toBe("2.3×");
    expect(formatZoom(33.7)).toBe("34×");
  });

  it("maps a screen position to a fraction of the log", () => {
    expect(fractionAt(150, 100, 200)).toBe(0.25);
    expect(fractionAt(50, 100, 200)).toBe(0);
    expect(fractionAt(400, 100, 200)).toBe(1);
  });
});
