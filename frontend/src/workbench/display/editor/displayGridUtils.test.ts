import { describe, expect, it } from "vitest";

import type { DisplayGridItem } from "../../../api/types";
import { clampGridItem, moveItem, toReactGridLayout } from "./displayGridUtils";

describe("displayGridUtils", () => {
  it("moves items without mutating the original collection", () => {
    const items = ["a", "b", "c"];

    expect(moveItem(items, 0, 2)).toEqual(["b", "c", "a"]);
    expect(items).toEqual(["a", "b", "c"]);
    expect(moveItem(items, 1, 1)).toEqual(items);
    expect(moveItem(items, 1, 99)).toEqual(items);
  });

  it("clamps grid items to the configured column and size limits", () => {
    const item: DisplayGridItem = { widgetId: "w1", x: 40, y: 99, w: 20, h: 30 };

    expect(clampGridItem(item, 12)).toEqual({ widgetId: "w1", x: 0, y: 30, w: 12, h: 12 });
    expect(clampGridItem({ widgetId: "w2", x: -5, y: -2, w: 0, h: 0 }, 12)).toEqual({
      widgetId: "w2",
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    });
  });

  it("maps display grid items to React Grid Layout items", () => {
    expect(toReactGridLayout([{ widgetId: "log-widget", x: 1, y: 2, w: 3, h: 4 }])).toEqual([
      { i: "log-widget", x: 1, y: 2, w: 3, h: 4, minW: 1, minH: 1 },
    ]);
  });
});
