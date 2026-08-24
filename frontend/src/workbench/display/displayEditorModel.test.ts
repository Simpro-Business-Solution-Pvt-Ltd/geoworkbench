import { describe, expect, it } from "vitest";

import type { Curve, DisplayLayout } from "../../api/types";
import { normalizeDisplayLayout } from "./displayEditorModel";

describe("normalizeDisplayLayout", () => {
  it("migrates legacy layouts to the runtime grid and prunes retired widgets", () => {
    const layout: DisplayLayout = {
      id: 1,
      name: "Legacy",
      mode: "runtime",
      settings: {
        widgets: {
          "log-widget": { type: "logWidget", title: "Log" },
          "data-arrival": { type: "dataArrival", title: "Incoming" },
          "export-panel": { type: "exportPanel", title: "Export" },
        },
        regions: {
          left: ["data-arrival"],
          center: ["log-widget"],
          right: ["export-panel"],
        },
        grid: {
          columns: 12,
          rowHeight: 72,
          items: [
            { widgetId: "log-widget", x: 0, y: 0, w: 8, h: 8 },
            { widgetId: "export-panel", x: 8, y: 0, w: 4, h: 4 },
          ],
        },
      },
    };

    const normalized = normalizeDisplayLayout(layout, [curve("ngamma")]);

    expect(normalized.settings.schemaVersion).toBe(4);
    expect(normalized.settings.widgets?.["data-arrival"]).toBeUndefined();
    expect(normalized.settings.widgets?.["export-panel"]).toBeUndefined();
    expect(normalized.settings.grid?.items.map((item) => item.widgetId)).toEqual([
      "log-widget",
      "correction-progress",
      "interpretation-queue",
    ]);
    expect(normalized.settings.regions).toEqual({ left: [], center: ["log-widget"], right: [] });
    expect(normalized.settings.widgets?.["log-widget"].tracks?.some((track) => track.id === "core-images")).toBe(true);
    expect(normalized.settings.widgets?.["correction-progress"].metric).toBe("corrected_interval_percent");
    expect(normalized.settings.widgets?.["interpretation-queue"].type).toBe("interpretationQueue");
  });

  it("adds current UAT default tracks to older saved log layouts once", () => {
    const layout: DisplayLayout = {
      id: 2,
      name: "Older saved display",
      mode: "runtime",
      settings: {
        schemaVersion: 2,
        widgets: {
          "log-widget": {
            type: "logWidget",
            title: "Log",
            tracks: [
              { id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 },
              { id: "lithology", type: "lithology", title: "Lithology", visible: true, width: 180 },
              { id: "curves", type: "curve", title: "Curves", visible: true, width: 260, curves: [] },
            ],
          },
        },
        grid: {
          columns: 12,
          rowHeight: 72,
          items: [{ widgetId: "log-widget", x: 0, y: 0, w: 8, h: 8 }],
        },
      },
    };

    const normalized = normalizeDisplayLayout(layout, [curve("ngamma")]);
    const trackIds = normalized.settings.widgets?.["log-widget"].tracks?.map((track) => track.id);

    expect(trackIds).toEqual(["depth", "lithology", "curves", "core-images", "recovery", "rqd", "ai-suggestions"]);
  });

  it("does not re-add removed default tracks after layout schema is current", () => {
    const layout: DisplayLayout = {
      id: 3,
      name: "Current saved display",
      mode: "runtime",
      settings: {
        schemaVersion: 4,
        widgets: {
          "log-widget": {
            type: "logWidget",
            title: "Log",
            tracks: [{ id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 }],
          },
        },
        grid: {
          columns: 12,
          rowHeight: 72,
          items: [{ widgetId: "log-widget", x: 0, y: 0, w: 8, h: 8 }],
        },
      },
    };

    const normalized = normalizeDisplayLayout(layout, [curve("ngamma")]);

    expect(normalized.settings.widgets?.["log-widget"].tracks?.map((track) => track.id)).toEqual(["depth"]);
    expect(normalized.settings.widgets?.["interpretation-queue"]).toBeUndefined();
  });
});

function curve(key: string): Curve {
  return {
    id: 1,
    key,
    label: "Natural Gamma",
    unit: "API",
    source_type: "las",
    color: "#aa6633",
    samples: [{ depth: 0, value: 42 }],
  };
}
