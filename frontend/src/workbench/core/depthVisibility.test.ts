import { describe, expect, it } from "vitest";

import {
  depthIntervalsIntersect,
  depthIsInsideInterval,
  intervalIntersectsDepthSpan,
  visibleDepthIntervals,
} from "./depthVisibility";

describe("depthVisibility", () => {
  it("detects inclusive depth interval intersections", () => {
    expect(depthIntervalsIntersect({ fromDepth: 10, toDepth: 20 }, { fromDepth: 20, toDepth: 30 })).toBe(true);
    expect(depthIntervalsIntersect({ fromDepth: 10, toDepth: 20 }, { fromDepth: 21, toDepth: 30 })).toBe(false);
  });

  it("normalizes reversed ranges before comparing", () => {
    expect(depthIntervalsIntersect({ fromDepth: 20, toDepth: 10 }, { fromDepth: 12, toDepth: 14 })).toBe(true);
    expect(intervalIntersectsDepthSpan({ from_depth: 30, to_depth: 20 }, { fromDepth: 10, toDepth: 25 })).toBe(true);
  });

  it("checks point depth inside intervals", () => {
    expect(depthIsInsideInterval(15, { from_depth: 10, to_depth: 20 })).toBe(true);
    expect(depthIsInsideInterval(20.1, { from_depth: 10, to_depth: 20 })).toBe(false);
  });

  it("filters visible intervals by depth span", () => {
    const items = [
      { id: "before", from_depth: 0, to_depth: 9 },
      { id: "touching", from_depth: 9, to_depth: 10 },
      { id: "inside", from_depth: 12, to_depth: 14 },
      { id: "after", from_depth: 21, to_depth: 22 },
    ];

    expect(visibleDepthIntervals(items, { fromDepth: 10, toDepth: 20 }).map((item) => item.id)).toEqual([
      "touching",
      "inside",
    ]);
  });
});
