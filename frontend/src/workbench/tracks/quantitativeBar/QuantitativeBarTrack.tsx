import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import { depthIsInsideInterval } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";
import { buildQuantitativeBarRenderModels } from "./quantitativeBarRenderModel";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function QuantitativeBarTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const barModels = buildQuantitativeBarRenderModels(data.lithology_intervals, track, scale, visibleDepthSpan);

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
      {barModels.map((model) => (
        <div
          key={model.key}
          className="quant-row"
          style={model.rowStyle}
          title={model.title}
        >
          <span style={model.barStyle} />
        </div>
      ))}
      {!barModels.length && (
        <div className="quant-track-empty">
          <strong>{track.title}</strong>
          <span>No {track.valueField === "rqd" ? "RQD" : "recovery"} values in visible data.</span>
        </div>
      )}
    </TrackFrame>
  );
}
