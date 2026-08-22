import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { DepthSpan } from "../../core/depthDomain";
import { intervalIntersectsDepthSpan } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

type RemarkGroup = {
  depth: number;
  y: number;
  count: number;
  text: string;
  remarks: Array<{ depth: number; text: string; sourceRow: number | null }>;
};

function groupedRemarks(data: BoreholeWorkbench, scale: DepthScale, visibleDepthSpan: DepthSpan): RemarkGroup[] {
  const remarkIntervals = data.lithology_intervals
    .filter((item) => item.remark)
    .filter((item) => intervalIntersectsDepthSpan(item, visibleDepthSpan))
    .map((item) => ({
      depth: item.from_depth,
      text: item.remark ?? "",
      sourceRow: item.source_row,
    }))
    .sort((a, b) => a.depth - b.depth);

  const groups: RemarkGroup[] = [];
  const bucketPixels = 26;

  for (const remark of remarkIntervals) {
    const y = scale.depthToY(remark.depth);
    const last = groups.at(-1);
    if (last && Math.abs(last.y - y) <= bucketPixels) {
      last.count += 1;
      last.text = `${last.text}; ${remark.text}`;
      last.remarks.push(remark);
      last.depth = Math.min(last.depth, remark.depth);
      last.y = Math.min(last.y, y);
    } else {
      groups.push({ depth: remark.depth, y, count: 1, text: remark.text, remarks: [remark] });
    }
  }

  return groups;
}

export function RemarksTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const groups = groupedRemarks(data, scale, visibleDepthSpan);

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="remarks-track"
      hitTest={({ depth }) => {
        const y = scale.depthToY(depth);
        const group = groups.find((item) => y >= item.y && y <= item.y + 26);
        return group
          ? {
              kind: "remark-group",
              id: `remarks:${group.depth}:${group.count}`,
              depth: group.depth,
              label: group.count > 1 ? `${group.depth.toFixed(1)}m group` : group.text,
              remarks: group.remarks,
            }
          : null;
      }}
    >
      {groups.map((group) => (
        <div
          key={`${group.depth}:${group.count}`}
          className="remark-group"
          style={{ top: `${group.y}px` }}
          title={group.text}
        >
          <b>{group.count}</b>
          <span>{group.count > 1 ? `${group.depth.toFixed(1)}m group` : group.text}</span>
        </div>
      ))}
    </TrackFrame>
  );
}
