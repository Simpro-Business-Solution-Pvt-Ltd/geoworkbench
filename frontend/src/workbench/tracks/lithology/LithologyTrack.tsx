import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import { depthIsInsideInterval, visibleDepthIntervals } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { lithologyPattern } from "../../core/lithologyPatterns";
import { TrackFrame } from "../../core/TrackFrame";
import { isCorrectedInterval } from "../../display/runtime/correctionDisplay";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function LithologyTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const visibleIntervals = visibleDepthIntervals(data.lithology_intervals, visibleDepthSpan);
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
      {visibleIntervals
        .map((interval) => {
          const pattern = lithologyPattern(interval.lithology_code);
          return (
            <div
              className={`lithology-block lithology-pattern ${pattern.className} ${isCorrectedInterval(interval) ? "corrected-interval" : ""}`}
              key={interval.id}
              style={{
                ...scale.intervalToStyle(interval.from_depth, interval.to_depth),
                backgroundColor: interval.display_color ?? pattern.color,
              }}
              title={`${interval.from_depth}-${interval.to_depth}m ${interval.lithology_code}`}
            />
          );
        })}
    </TrackFrame>
  );
}
