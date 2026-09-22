import { describe, expect, it } from "vitest";

import type { LithologyInterval } from "../../api/types";
import { legendForIntervals, lithologyPattern } from "./lithologyPatterns";

describe("lithologyPatterns", () => {
  it("resolves lithology by normalized code alias", () => {
    expect(lithologyPattern("c-sh").className).toBe("pattern-carbonaceous");
    expect(lithologyPattern("SST").className).toBe("pattern-sandstone");
  });

  it("falls back to descriptive lithology labels when code is missing or unknown", () => {
    expect(lithologyPattern(null, "Fine grained sandstone").className).toBe("pattern-sandstone");
    expect(lithologyPattern("UNKNOWN", "Carbonaceous shale with coal streaks").className).toBe("pattern-carbonaceous");
    expect(lithologyPattern("", "Limestone band").className).toBe("pattern-limestone");
  });

  it("uses dictionary labels in the log legend", () => {
    const legend = legendForIntervals([
      interval("a", null, "Fine sandstone"),
      interval("b", "C-SH", "Carbonaceous shale"),
    ]);

    expect(legend.map((item) => item.label)).toEqual(["Sandstone", "Carbonaceous shale"]);
  });
});

function interval(id: string, code: string | null, label: string): LithologyInterval {
  return {
    id,
    source_row: null,
    from_depth: 0,
    to_depth: 1,
    lithology_code: code,
    lithology_label: label,
    display_color: null,
    logged_color: null,
    seam_name: null,
    recovery: null,
    recovery_percent: null,
    rqd: null,
    structural_features: null,
    remark: null,
    image_box: null,
    image_file: null,
  };
}
