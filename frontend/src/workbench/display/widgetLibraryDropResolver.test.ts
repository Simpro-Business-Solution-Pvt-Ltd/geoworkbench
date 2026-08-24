import { describe, expect, it } from "vitest";

import type { DisplayLayout } from "../../api/types";
import { createWidgetLibraryDragPayload, resolveWidgetLibraryDrop } from "./widgetLibraryDropResolver";

describe("widgetLibraryDropResolver", () => {
  it("adds a catalog widget with its default size at the requested grid placement", () => {
    const result = resolveWidgetLibraryDrop(
      sampleLayout(),
      createWidgetLibraryDragPayload("logWidget"),
      [],
      { x: 4, y: 2 },
    );

    expect(result.status).toBe("changed");
    if (result.status !== "changed") throw new Error("expected changed result");
    expect(result.widgetId).toBe("log-widget");
    expect(result.layout.settings.widgets?.["log-widget"].type).toBe("logWidget");
    expect(result.layout.settings.grid?.items[0]).toMatchObject({ widgetId: "log-widget", x: 4, y: 2, w: 7, h: 8 });
  });

  it("creates unique widget ids for duplicate widget types", () => {
    const first = resolveWidgetLibraryDrop(sampleLayout(), createWidgetLibraryDragPayload("singleValue"), []);
    if (first.status !== "changed") throw new Error("expected changed result");
    const second = resolveWidgetLibraryDrop(first.layout, createWidgetLibraryDragPayload("singleValue"), []);

    expect(second.status).toBe("changed");
    if (second.status !== "changed") throw new Error("expected changed result");
    expect(second.widgetId).toBe("single-value-2");
  });
});

function sampleLayout(): DisplayLayout {
  return {
    id: 1,
    name: "Demo",
    mode: "workbench",
    settings: {
      schemaVersion: 5,
      grid: { columns: 12, rowHeight: 72, items: [] },
      widgets: {},
    },
  };
}
