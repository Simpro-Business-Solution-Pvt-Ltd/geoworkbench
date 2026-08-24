import type { AiSuggestion, BoreholeWorkbench, ValidationIssue } from "../../../api/types";

export type InterpretationQueuePriority = "critical" | "review" | "watch" | "ready";

export type InterpretationQueueItem = {
  id: string;
  priority: InterpretationQueuePriority;
  source: "validation" | "ai" | "curves" | "core-images" | "seams" | "metadata" | "workflow";
  title: string;
  detail: string;
  evidence: string;
  depth: number | null;
  suggestionId?: number;
  action:
    | "select-depth"
    | "select-ai"
    | "run-validation"
    | "generate-ai"
    | "review-metadata"
    | "review-workflow";
};

export function buildInterpretationQueue(data: BoreholeWorkbench): InterpretationQueueItem[] {
  const items: InterpretationQueueItem[] = [];

  for (const issue of openValidationIssues(data.validation_issues).slice(0, 5)) {
    items.push({
      id: `validation:${issue.id}`,
      priority: priorityForValidation(issue),
      source: "validation",
      title: issue.code.replaceAll("_", " "),
      detail: issue.message,
      evidence: depthEvidence(issue.from_depth, issue.to_depth, issue.severity),
      depth: issue.from_depth,
      action: issue.from_depth !== null ? "select-depth" : "run-validation",
    });
  }

  for (const suggestion of data.ai_suggestions.filter((item) => item.status === "open").slice(0, 5)) {
    items.push({
      id: `ai:${suggestion.id}`,
      priority: priorityForSuggestion(suggestion),
      source: "ai",
      title: suggestion.title,
      detail: suggestion.recommended_action || suggestion.rationale,
      evidence: depthEvidence(suggestion.from_depth, suggestion.to_depth, suggestion.provider),
      depth: suggestion.from_depth,
      suggestionId: suggestion.id,
      action: "select-ai",
    });
  }

  const curveDepths = data.curves.flatMap((curve) => curve.samples.map((sample) => sample.depth));
  if (!data.curves.length) {
    items.push({
      id: "curves:missing",
      priority: "review",
      source: "curves",
      title: "Geophysical curves missing",
      detail: "No LAS/geophysical curves are available for this borehole review.",
      evidence: "Curve track and correlation confidence are lithology-only.",
      depth: null,
      action: "review-workflow",
    });
  } else if (curveDepths.length) {
    const fromDepth = Math.min(...curveDepths);
    const toDepth = Math.max(...curveDepths);
    const coverage = data.total_depth > 0 ? ((toDepth - fromDepth) / data.total_depth) * 100 : 0;
    if (coverage < 80) {
      items.push({
        id: "curves:coverage",
        priority: "watch",
        source: "curves",
        title: "Curve coverage is partial",
        detail: `Imported curves cover ${coverage.toFixed(1)}% of total depth.`,
        evidence: `${fromDepth.toFixed(1)}-${toDepth.toFixed(1)}m of ${data.total_depth.toFixed(1)}m TD`,
        depth: fromDepth,
        action: "select-depth",
      });
    }
  }

  if (!data.core_images.length) {
    items.push({
      id: "core-images:missing",
      priority: "watch",
      source: "core-images",
      title: "Core image evidence not supplied",
      detail: "The core image track will show a missing package state until images are uploaded or processed.",
      evidence: "No core image records linked to this borehole.",
      depth: null,
      action: "review-workflow",
    });
  }

  if (!data.seam_intervals.length) {
    items.push({
      id: "seams:missing",
      priority: "review",
      source: "seams",
      title: "No seam markers available",
      detail: "Correlation and seam continuity review need seam names or marker intervals.",
      evidence: `${data.lithology_intervals.length} lithology intervals, 0 seams`,
      depth: null,
      action: "review-workflow",
    });
  }

  const collar = objectValue(objectValue(data.attributes).collar);
  if (!hasAnyNumber(collar, ["coalgrid_easting", "utm_easting"]) || !hasAnyNumber(collar, ["coalgrid_northing", "utm_northing"])) {
    items.push({
      id: "metadata:coordinates",
      priority: "watch",
      source: "metadata",
      title: "Collar coordinates need confirmation",
      detail: "Spatial context is incomplete for nearby-borehole comparison and correlation.",
      evidence: "Coalgrid/UTM easting or northing is missing.",
      depth: null,
      action: "review-metadata",
    });
  }

  if (!items.length) {
    items.push({
      id: "workflow:ready",
      priority: "ready",
      source: "workflow",
      title: "Ready for interpretation review",
      detail: "No open validation or AI action is currently blocking central review.",
      evidence: `${data.lithology_intervals.length} intervals · ${data.curves.length} curves · ${data.seam_intervals.length} seams`,
      depth: null,
      action: "generate-ai",
    });
  }

  return items.sort(compareQueueItems).slice(0, 10);
}

function compareQueueItems(left: InterpretationQueueItem, right: InterpretationQueueItem) {
  return priorityRank(left.priority) - priorityRank(right.priority) || left.id.localeCompare(right.id);
}

function priorityRank(priority: InterpretationQueuePriority) {
  if (priority === "critical") return 0;
  if (priority === "review") return 1;
  if (priority === "watch") return 2;
  return 3;
}

function openValidationIssues(issues: ValidationIssue[]) {
  return issues.filter((issue) => !["resolved", "accepted", "rejected"].includes(issue.status));
}

function priorityForValidation(issue: ValidationIssue): InterpretationQueuePriority {
  if (issue.severity === "error") return "critical";
  if (issue.severity === "warning") return "review";
  return "watch";
}

function priorityForSuggestion(suggestion: AiSuggestion): InterpretationQueuePriority {
  if (suggestion.confidence !== null && suggestion.confidence >= 0.75) return "review";
  return "watch";
}

function depthEvidence(fromDepth: number | null, toDepth: number | null, suffix: string) {
  if (fromDepth === null) return `Whole borehole · ${suffix}`;
  if (toDepth === null || toDepth === fromDepth) return `${fromDepth.toFixed(2)}m · ${suffix}`;
  return `${fromDepth.toFixed(2)}-${toDepth.toFixed(2)}m · ${suffix}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function hasAnyNumber(source: Record<string, unknown>, keys: string[]) {
  return keys.some((key) => typeof source[key] === "number" && Number.isFinite(source[key]));
}
