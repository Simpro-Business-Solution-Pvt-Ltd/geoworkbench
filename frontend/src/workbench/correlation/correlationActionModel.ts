import type { CorrelationInsight } from "./correlationInsights";

export function correlationInsightObservationText(insight: CorrelationInsight): string {
  return [
    `${insight.title}`,
    `Interpretation: ${insight.detail}`,
    `Evidence: ${insight.evidence}`,
    `Action: ${insight.action}`,
  ].join("\n");
}

export function correlationDecisionPrompt(insight: CorrelationInsight): string {
  if (insight.severity === "good") return "Save continuity observation";
  if (insight.severity === "watch") return "Save watch note";
  return "Save review action";
}
