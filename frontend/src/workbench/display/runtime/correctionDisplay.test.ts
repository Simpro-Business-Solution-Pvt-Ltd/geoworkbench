import { describe, expect, it } from "vitest";

import {
  correctionChangePreview,
  correctionFieldSummary,
  intervalStageLabel,
  isCorrectedInterval,
} from "./correctionDisplay";

describe("correctionDisplay", () => {
  it("identifies corrected interpretation stages", () => {
    expect(isCorrectedInterval({ attributes: { data_stage: "geologist_corrected" } })).toBe(true);
    expect(isCorrectedInterval({ attributes: { data_stage: "raw_imported" } })).toBe(false);
    expect(intervalStageLabel({ attributes: { data_stage_label: "Geologist corrected" } })).toBe("Geologist corrected");
  });

  it("summarizes audit field names and before-after values", () => {
    const audit = {
      before_values: { seam_name: "A", recovery_percent: 76, attributes: { data_stage: "raw_imported" } },
      after_values: { seam_name: "A1", recovery_percent: 82, attributes: { data_stage: "geologist_corrected" } },
    };

    expect(correctionFieldSummary(audit)).toBe("Seam, Recovery %");
    expect(correctionChangePreview(audit)).toBe("Seam: A -> A1 · Recovery %: 76 -> 82");
  });
});
