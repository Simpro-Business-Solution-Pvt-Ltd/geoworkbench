import { describe, expect, it } from "vitest";

import type { Curve } from "../../api/types";
import { createCatalogWidget, createWidgetId, widgetLabel } from "./widgetCatalog";

describe("widgetCatalog", () => {
  it("creates log widgets with default tracks from the shared track catalog", () => {
    const widget = createCatalogWidget("logWidget", [curve("ngamma")]);

    expect(widget.type).toBe("logWidget");
    expect(widget.tracks?.some((track) => track.id === "core-images")).toBe(true);
    expect(widget.tracks?.find((track) => track.type === "curve")?.curves?.[0].curveKey).toBe("ngamma");
  });

  it("creates stable unique widget ids and labels single-value widgets with their metric", () => {
    expect(createWidgetId("logWidget", new Set(["log-widget", "log-widget-2"]))).toBe("log-widget-3");
    expect(createWidgetId("interpretationQueue", new Set(["interpretation-queue"]))).toBe("interpretation-queue-2");
    expect(widgetLabel({ type: "singleValue", title: "Curve Coverage", metric: "curve_coverage_percent" })).toBe(
      "Curve Coverage (curve_coverage_percent)",
    );
  });

  it("creates the interpretation queue as a geologist action widget", () => {
    const widget = createCatalogWidget("interpretationQueue", []);

    expect(widget).toMatchObject({
      type: "interpretationQueue",
      title: "Interpretation Queue",
      settings: { maxItems: 10 },
    });
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
