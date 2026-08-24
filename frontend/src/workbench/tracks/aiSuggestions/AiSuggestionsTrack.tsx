import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { numericRendererSetting } from "../../core/rendererSettings";
import { TrackFrame } from "../../core/TrackFrame";
import { useWorkbenchStore } from "../../display/workbenchStore";
import { buildAiSuggestionGroupRenderModels, findAiSuggestionGroupAtY } from "./aiSuggestionsRenderModel";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

const DEFAULT_BUCKET_PIXELS = 28;
const DEFAULT_HIT_TOP_PADDING_PX = 2;
const DEFAULT_HIT_HEIGHT_PX = 28;
const DEFAULT_LABEL_MAX_VISIBLE_SPAN_M = 120;

export function AiSuggestionsTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const selectedAiSuggestion = useWorkbenchStore((state) => state.selectedAiSuggestion);
  const bucketPixels = numericRendererSetting(track, "bucketPixels", DEFAULT_BUCKET_PIXELS);
  const hitTopPaddingPx = numericRendererSetting(track, "hitTopPaddingPx", DEFAULT_HIT_TOP_PADDING_PX);
  const hitHeightPx = numericRendererSetting(track, "hitHeightPx", DEFAULT_HIT_HEIGHT_PX);
  const labelMaxVisibleSpanM = numericRendererSetting(track, "labelMaxVisibleSpanM", DEFAULT_LABEL_MAX_VISIBLE_SPAN_M);
  const groups = buildAiSuggestionGroupRenderModels(data, scale, visibleDepthSpan, {
    bucketPixels,
    labelMaxVisibleSpanM,
  });

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="ai-track"
      hitTest={({ depth }) => {
        const y = scale.depthToY(depth);
        const group = findAiSuggestionGroupAtY(groups, y, { hitTopPaddingPx, hitHeightPx });
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
      {groups.length === 0 && (
        <div className="ai-track-empty">
          {data.ai_suggestions.length > 0 ? "No AI findings in view" : "Run AI review"}
        </div>
      )}
      {groups.map((group) => {
        const primary = group.suggestions[0];
        const isSelected = group.suggestions.some((suggestion) => suggestion.id === selectedAiSuggestion?.id);
        return (
          <button
            type="button"
            key={group.id}
            className={`ai-marker ${group.className} ${group.showDetail ? "" : "compact"} ${isSelected ? "selected" : ""}`}
            style={{ top: `${group.y}px` }}
            title={group.title}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              useWorkbenchStore.getState().setSelectedDepth(group.depth);
              useWorkbenchStore.getState().setSelectedAiSuggestion(primary);
            }}
          >
            <b>{group.suggestions.length}</b>
            {group.showDetail && (
              <>
                <span>{group.suggestions.length > 1 ? group.label : primary.suggestion_type.replaceAll("_", " ")}</span>
                <small>{group.confidenceLabel}</small>
              </>
            )}
          </button>
        );
      })}
    </TrackFrame>
  );
}
