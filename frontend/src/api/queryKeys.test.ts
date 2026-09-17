import { describe, expect, it } from "vitest";

import { queryKeys } from "./queryKeys";

describe("query keys", () => {
  it("separates workbench layouts while retaining a borehole prefix", () => {
    expect(queryKeys.workbench(12, 5)).toEqual(["workbench", 12, 5]);
    expect(queryKeys.workbench(12, 6)).not.toEqual(queryKeys.workbench(12, 5));
    expect(queryKeys.workbench(12, 5).slice(0, 2)).toEqual(["workbench", 12]);
  });

  it("separates curve sample roots by borehole", () => {
    expect(queryKeys.curveSamplesRoot(12)).toEqual(["curveSamples", 12]);
    expect(queryKeys.curveSamplesRoot(13)).not.toEqual(queryKeys.curveSamplesRoot(12));
  });

  it("includes every correlation summary input", () => {
    expect(queryKeys.correlationAi("1:2", "S1", "depth")).not.toEqual(
      queryKeys.correlationAi("1:2", "S1", "rl"),
    );
  });
});
