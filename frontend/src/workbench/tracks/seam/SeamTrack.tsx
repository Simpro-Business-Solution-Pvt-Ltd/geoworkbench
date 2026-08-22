import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import { depthIsInsideInterval, visibleDepthIntervals } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

const DEFAULT_LABEL_MIN_HEIGHT_PX = 18;

function numericRendererSetting(track: DisplayTrack, key: string, fallback: number): number {
  const value = track.renderer?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function SeamTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const labelMinHeightPx = numericRendererSetting(track, "labelMinHeightPx", DEFAULT_LABEL_MIN_HEIGHT_PX);
  const visibleSeams = visibleDepthIntervals(data.seam_intervals, visibleDepthSpan);

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="seam-track"
      hitTest={({ depth }) => {
        const seam = data.seam_intervals.find((item) => depthIsInsideInterval(depth, item));
        return seam ? { kind: "seam-interval", id: seam.id, depth, seam } : null;
      }}
    >
      {visibleSeams
        .map((seam) => {
          const style = scale.intervalToStyle(seam.from_depth, seam.to_depth);
          const pixelHeight = Math.abs(scale.depthToY(seam.to_depth) - scale.depthToY(seam.from_depth));
          const showLabel = pixelHeight >= labelMinHeightPx;
          return (
            <div
              className="seam-marker"
              key={seam.id}
              style={{
                ...style,
                minHeight: "4px",
              }}
              title={`${seam.name}: ${seam.from_depth}-${seam.to_depth}m`}
            >
              {showLabel && <span>{seam.name}</span>}
            </div>
          );
        })}
    </TrackFrame>
  );
}
