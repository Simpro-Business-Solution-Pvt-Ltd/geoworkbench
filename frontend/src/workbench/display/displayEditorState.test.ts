import { describe, expect, it } from "vitest";

import type { DisplayLayout } from "../../api/types";
import { buildDisplayEditorSummary, displayLayoutsEqual } from "./displayEditorState";

describe("displayEditorState", () => {
  it("compares layout name, mode, and settings for dirty checks", () => {
    const layout = sampleLayout();

    expect(displayLayoutsEqual(layout, structuredClone(layout))).toBe(true);
    expect(displayLayoutsEqual(layout, { ...structuredClone(layout), name: "Changed" })).toBe(false);
  });

  it("summarizes widgets, grid items, tracks, and configured curves", () => {
    expect(buildDisplayEditorSummary(sampleLayout())).toEqual({
      widgetCount: 2,
      gridItemCount: 2,
      logTrackCount: 2,
      configuredCurveCount: 2,
    });
  });
});

function sampleLayout(): DisplayLayout {
  return {
    id: 1,
    name: "Review",
    mode: "runtime",
    settings: {
      schemaVersion: 5,
      widgets: {
        "log-widget": {
          type: "logWidget",
          title: "Log",
          tracks: [
            { id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 },
            {
              id: "curves",
              type: "curve",
              title: "Curves",
              visible: true,
              width: 260,
              curves: [
                {
                  curveKey: "gamma",
                  label: "Gamma",
                  unit: "API",
                  color: "#f00",
                  visible: true,
                  scale: { mode: "linear", min: 0, max: 200 },
                },
                {
                  curveKey: "density",
                  label: "Density",
                  unit: "g/cc",
                  color: "#0f0",
                  visible: true,
                  scale: { mode: "linear", min: 1, max: 3 },
                },
              ],
            },
          ],
        },
        "interval-details": { type: "intervalDetails", title: "Depth Metadata" },
      },
      grid: {
        columns: 12,
        rowHeight: 72,
        items: [
          { widgetId: "log-widget", x: 0, y: 0, w: 8, h: 8 },
          { widgetId: "interval-details", x: 8, y: 0, w: 4, h: 4 },
        ],
      },
    },
  };
}
