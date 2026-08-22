import type { BoreholeWorkbench, DisplayTrack, LithologyInterval } from "../../../api/types";
import { depthIsInsideInterval, visibleDepthIntervals } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

function valueForInterval(track: DisplayTrack, interval: LithologyInterval): number | null {
  if (!track.valueField) return null;
  const raw = interval[track.valueField];
  if (raw === null || raw === undefined) return null;
  return raw * (track.valueMultiplier ?? 1);
}

export function QuantitativeBarTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const min = track.min ?? 0;
  const max = track.max ?? 100;
  const span = Math.max(0.001, max - min);
  const visibleIntervals = visibleDepthIntervals(data.lithology_intervals, visibleDepthSpan);

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="quant-track"
      hitTest={({ depth }) => {
        const interval = data.lithology_intervals.find((item) => depthIsInsideInterval(depth, item));
        return interval ? { kind: "lithology-interval", id: interval.id, depth, interval } : null;
      }}
    >
      {visibleIntervals
        .map((interval) => {
          const value = valueForInterval(track, interval);
          if (value === null) return null;
          const width = Math.max(0, Math.min(100, ((value - min) / span) * 100));
          return (
            <div
              key={`${track.id}:${interval.id}`}
              className="quant-row"
              style={scale.intervalToStyle(interval.from_depth, interval.to_depth)}
              title={`${track.title}: ${value.toFixed(1)}${track.unit ?? ""}`}
            >
              <span style={{ width: `${width}%`, background: track.color ?? "#55b7aa" }} />
            </div>
          );
        })}
    </TrackFrame>
  );
}
