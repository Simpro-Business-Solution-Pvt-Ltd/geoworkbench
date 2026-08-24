import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { numericRendererSetting } from "../../core/rendererSettings";
import { TrackFrame } from "../../core/TrackFrame";
import { buildRemarkGroupRenderModels, findRemarkGroupAtY } from "./remarksRenderModel";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

const DEFAULT_BUCKET_PIXELS = 26;
const DEFAULT_HIT_HEIGHT_PX = 26;
const DEFAULT_LABEL_MAX_VISIBLE_SPAN_M = 120;

export function RemarksTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const bucketPixels = numericRendererSetting(track, "bucketPixels", DEFAULT_BUCKET_PIXELS);
  const hitHeightPx = numericRendererSetting(track, "hitHeightPx", DEFAULT_HIT_HEIGHT_PX);
  const labelMaxVisibleSpanM = numericRendererSetting(
    track,
    "labelMaxVisibleSpanM",
    DEFAULT_LABEL_MAX_VISIBLE_SPAN_M,
  );
  const groups = buildRemarkGroupRenderModels(data, scale, visibleDepthSpan, { bucketPixels, labelMaxVisibleSpanM });

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="remarks-track"
      hitTest={({ depth }) => {
        const y = scale.depthToY(depth);
        const group = findRemarkGroupAtY(groups, y, hitHeightPx);
        return group
          ? {
              kind: "remark-group",
              id: `remarks:${group.key}`,
              depth: group.depth,
              label: group.label,
              remarks: group.remarks,
            }
          : null;
      }}
    >
      {groups.map((group) => (
        <div
          key={group.key}
          className={`remark-group ${group.showLabel ? "" : "collapsed"}`}
          style={{ top: `${group.y}px` }}
          title={group.text}
        >
          <b>{group.count}</b>
          {group.showLabel && <span>{group.label}</span>}
        </div>
      ))}
    </TrackFrame>
  );
}
