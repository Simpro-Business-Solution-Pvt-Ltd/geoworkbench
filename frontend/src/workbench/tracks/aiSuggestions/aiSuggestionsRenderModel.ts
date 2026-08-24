import type { AiSuggestion, BoreholeWorkbench } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { DepthSpan } from "../../core/depthDomain";
import { depthIntervalsIntersect } from "../../core/depthVisibility";

export type AiSuggestionGroupRenderModel = {
  id: string;
  depth: number;
  y: number;
  label: string;
  className: string;
  confidenceLabel: string;
  title: string;
  suggestions: AiSuggestion[];
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  accepted: 1,
  rejected: 2,
};

const RENDERABLE_STATUSES = new Set(["open", "accepted", "rejected"]);

export function buildAiSuggestionGroupRenderModels(
  data: BoreholeWorkbench,
  scale: DepthScale,
  visibleDepthSpan: DepthSpan,
  options: { bucketPixels: number },
): AiSuggestionGroupRenderModel[] {
  const visibleSuggestions = data.ai_suggestions
    .filter((suggestion) => RENDERABLE_STATUSES.has(suggestion.status))
    .map((suggestion, index) => {
      const depth = suggestionDepth(suggestion, index, data.total_depth);
      const toDepth = suggestion.to_depth ?? depth;
      return { suggestion, depth, toDepth, y: scale.depthToY(depth) };
    })
    .filter(({ suggestion, depth, toDepth }) => {
      if (suggestion.from_depth === null) return true;
      return depthIntervalsIntersect(
        { fromDepth: depth, toDepth },
        visibleDepthSpan,
      );
    })
    .sort((a, b) => {
      const statusDelta = (STATUS_ORDER[a.suggestion.status] ?? 10) - (STATUS_ORDER[b.suggestion.status] ?? 10);
      if (statusDelta !== 0) return statusDelta;
      return a.depth - b.depth;
    });

  const groups: AiSuggestionGroupRenderModel[] = [];
  for (const item of visibleSuggestions) {
    const last = groups.at(-1);
    if (last && Math.abs(last.y - item.y) <= options.bucketPixels) {
      last.suggestions.push(item.suggestion);
      last.depth = Math.min(last.depth, item.depth);
      last.y = Math.min(last.y, item.y);
      refreshGroup(last);
    } else {
      groups.push(createGroup(item.suggestion, item.depth, item.y));
    }
  }

  return groups;
}

export function findAiSuggestionGroupAtY(
  groups: AiSuggestionGroupRenderModel[],
  y: number,
  options: { hitTopPaddingPx: number; hitHeightPx: number },
): AiSuggestionGroupRenderModel | null {
  return groups.find((item) => y >= item.y - options.hitTopPaddingPx && y <= item.y + options.hitHeightPx) ?? null;
}

export function suggestionDepth(suggestion: AiSuggestion, index: number, totalDepth: number) {
  if (suggestion.from_depth !== null) return suggestion.from_depth;
  return Math.min(totalDepth, 0.5 + index * 1.25);
}

export function confidenceLabel(value: number | null) {
  if (value === null) return "";
  return `${Math.round(value * 100)}%`;
}

function createGroup(suggestion: AiSuggestion, depth: number, y: number): AiSuggestionGroupRenderModel {
  const group = {
    id: `ai:${suggestion.id}`,
    depth,
    y,
    label: "",
    className: "",
    confidenceLabel: "",
    title: "",
    suggestions: [suggestion],
  };
  refreshGroup(group);
  return group;
}

function refreshGroup(group: AiSuggestionGroupRenderModel) {
  const primary = group.suggestions[0];
  group.label = groupLabel(group.suggestions, group.depth);
  group.className = `${primary.status} ${primary.suggestion_type}`;
  group.confidenceLabel = confidenceLabel(primary.confidence);
  group.title = group.suggestions.map((suggestion) => suggestion.title).join("\n");
}

function groupLabel(suggestions: AiSuggestion[], depth: number) {
  if (suggestions.length === 1) return suggestions[0].title;
  return `${suggestions.length} AI items near ${depth.toFixed(1)}m`;
}
