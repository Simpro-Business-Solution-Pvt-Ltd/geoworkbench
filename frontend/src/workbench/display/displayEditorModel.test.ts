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

    expect(normalized.settings.widgets?.["data-arrival"]).toBeUndefined();
    expect(normalized.settings.widgets?.["export-panel"]).toBeUndefined();
    expect(normalized.settings.grid?.items.map((item) => item.widgetId)).toEqual(["log-widget", "correction-progress"]);
    expect(normalized.settings.regions).toEqual({ left: [], center: ["log-widget"], right: [] });
    expect(normalized.settings.widgets?.["log-widget"].tracks?.some((track) => track.id === "core-images")).toBe(true);
    expect(normalized.settings.widgets?.["correction-progress"].metric).toBe("corrected_interval_percent");
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
