import type { AiSuggestion, BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";
import { useWorkbenchStore } from "../../display/workbenchStore";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

type SuggestionGroup = {
  id: string;
  depth: number;
  y: number;
  label: string;
  suggestions: AiSuggestion[];
};

const STATUS_ORDER: Record<string, number> = {
  open: 0,
  accepted: 1,
  rejected: 2,
};

function suggestionDepth(suggestion: AiSuggestion, index: number, totalDepth: number) {
  if (suggestion.from_depth !== null) return suggestion.from_depth;
  return Math.min(totalDepth, 0.5 + index * 1.25);
}

function suggestionGroups(data: BoreholeWorkbench, scale: DepthScale): SuggestionGroup[] {
  const visibleSuggestions = data.ai_suggestions
    .filter((suggestion) => ["open", "accepted", "rejected"].includes(suggestion.status))
    .map((suggestion, index) => {
      const depth = suggestionDepth(suggestion, index, data.total_depth);
      const toDepth = suggestion.to_depth ?? depth;
      return { suggestion, depth, toDepth, y: scale.depthToY(depth) };
    })
    .filter(
      ({ suggestion, depth, toDepth }) =>
        suggestion.from_depth === null ||
        (depth <= scale.toDepth && toDepth >= scale.fromDepth),
    )
    .sort((a, b) => {
      const statusDelta = (STATUS_ORDER[a.suggestion.status] ?? 10) - (STATUS_ORDER[b.suggestion.status] ?? 10);
      if (statusDelta !== 0) return statusDelta;
      return a.depth - b.depth;
    });

  const groups: SuggestionGroup[] = [];
  const bucketPixels = 28;

  for (const item of visibleSuggestions) {
    const last = groups.at(-1);
    if (last && Math.abs(last.y - item.y) <= bucketPixels) {
      last.suggestions.push(item.suggestion);
      last.depth = Math.min(last.depth, item.depth);
      last.y = Math.min(last.y, item.y);
      last.label = groupLabel(last.suggestions, last.depth);
    } else {
      groups.push({
        id: `ai:${item.suggestion.id}`,
        depth: item.depth,
        y: item.y,
        label: groupLabel([item.suggestion], item.depth),
        suggestions: [item.suggestion],
      });
    }
  }

  return groups;
}

function groupLabel(suggestions: AiSuggestion[], depth: number) {
  if (suggestions.length === 1) return suggestions[0].title;
  return `${suggestions.length} AI items near ${depth.toFixed(1)}m`;
}

function primarySuggestionClass(group: SuggestionGroup) {
  const suggestion = group.suggestions[0];
  return `${suggestion.status} ${suggestion.suggestion_type}`;
}

function confidenceLabel(value: number | null) {
  if (value === null) return "";
  return `${Math.round(value * 100)}%`;
}

export function AiSuggestionsTrack({ data, track, context }: Props) {
  const { scale } = context;
  const selectedAiSuggestion = useWorkbenchStore((state) => state.selectedAiSuggestion);
  const groups = suggestionGroups(data, scale);

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="ai-track"
      hitTest={({ depth }) => {
        const y = scale.depthToY(depth);
        const group = groups.find((item) => y >= item.y - 2 && y <= item.y + 28);
        return group
          ? {
              kind: "ai-suggestion-group",
              id: group.id,
              depth: group.depth,
              label: group.label,
              suggestions: group.suggestions,
            }
          : null;
      }}
    >
      {groups.length === 0 && <div className="ai-track-empty">Run AI review</div>}
      {groups.map((group) => {
        const primary = group.suggestions[0];
        const isSelected = group.suggestions.some((suggestion) => suggestion.id === selectedAiSuggestion?.id);
        return (
          <button
            type="button"
            key={group.id}
            className={`ai-marker ${primarySuggestionClass(group)} ${isSelected ? "selected" : ""}`}
            style={{ top: `${group.y}px` }}
            title={group.suggestions.map((suggestion) => suggestion.title).join("\n")}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              useWorkbenchStore.getState().setSelectedDepth(group.depth);
              useWorkbenchStore.getState().setSelectedAiSuggestion(primary);
            }}
          >
            <b>{group.suggestions.length}</b>
            <span>{group.suggestions.length > 1 ? group.label : primary.suggestion_type.replaceAll("_", " ")}</span>
            <small>{confidenceLabel(primary.confidence)}</small>
          </button>
        );
      })}
    </TrackFrame>
  );
}
