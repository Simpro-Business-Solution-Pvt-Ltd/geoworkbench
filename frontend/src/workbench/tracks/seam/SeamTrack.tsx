import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function SeamTrack({ data, track, context }: Props) {
  const { scale } = context;
  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="seam-track"
      hitTest={({ depth }) => {
        const seam = data.seam_intervals.find(
          (item) => item.from_depth <= depth && item.to_depth >= depth,
        );
        return seam ? { kind: "seam-interval", id: seam.id, depth, seam } : null;
      }}
    >
      {data.seam_intervals
        .filter((seam) => seam.to_depth >= scale.fromDepth && seam.from_depth <= scale.toDepth)
        .map((seam) => (
        <div
          className="seam-marker"
          key={seam.id}
          style={{
            ...scale.intervalToStyle(seam.from_depth, seam.to_depth),
            minHeight: "4px",
          }}
          title={`${seam.name}: ${seam.from_depth}-${seam.to_depth}m`}
        >
          {seam.name}
        </div>
      ))}
    </TrackFrame>
  );
}
