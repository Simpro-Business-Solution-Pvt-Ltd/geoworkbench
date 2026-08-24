import { describe, expect, it } from "vitest";

import { correlationDecisionPrompt, correlationInsightObservationText } from "./correlationActionModel";
import type { CorrelationInsight } from "./correlationInsights";

describe("correlationActionModel", () => {
  it("formats insight evidence as a persisted geologist observation", () => {
    const insight: CorrelationInsight = {
      id: "missing:S1",
      severity: "review",
      title: "Missing marker review: S1",
      detail: "S1 is present in nearby boreholes but missing here.",
      evidence: "BH-1 120.0-121.0m",
      action: "Compare the expected depth against gamma response.",
    };

    expect(correlationInsightObservationText(insight)).toBe(
      [
        "Missing marker review: S1",
        "Interpretation: S1 is present in nearby boreholes but missing here.",
        "Evidence: BH-1 120.0-121.0m",
        "Action: Compare the expected depth against gamma response.",
      ].join("\n"),
    );
  });

  it("uses severity-specific action labels", () => {
    expect(correlationDecisionPrompt(insight("good"))).toBe("Save continuity observation");
    expect(correlationDecisionPrompt(insight("watch"))).toBe("Save watch note");
    expect(correlationDecisionPrompt(insight("review"))).toBe("Save review action");
  });
});

function insight(severity: CorrelationInsight["severity"]): CorrelationInsight {
  return {
    id: severity,
    severity,
    title: "Insight",
    detail: "Detail",
    evidence: "Evidence",
    action: "Action",
  };
}
