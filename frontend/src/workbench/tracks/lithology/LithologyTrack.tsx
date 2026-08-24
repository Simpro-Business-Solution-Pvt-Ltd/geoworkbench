import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import { depthIsInsideInterval } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";
import { buildLithologyRenderModels } from "./lithologyRenderModel";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function LithologyTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const lithologyModels = buildLithologyRenderModels(data.lithology_intervals, scale, visibleDepthSpan);
  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="lithology-track"
      hitTest={({ depth }) => {
        const interval = data.lithology_intervals.find((item) => depthIsInsideInterval(depth, item));
        return interval
          ? {
              kind: "lithology-interval",
              id: interval.id,
              depth,
              interval,
            }
          : null;
      }}
    >
      {lithologyModels.map((model) => (
        <div
          className={model.className}
          key={model.key}
          style={model.style}
          title={model.title}
        />
      ))}
    </TrackFrame>
  );
}
