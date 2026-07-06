import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { TrackFrame } from "../../core/TrackFrame";
import { generateDepthTicks } from "../../core/ticks";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function DepthTrack({ data, track, context }: Props) {
  const { scale } = context;
  const pixelsPerMeter = scale.drawableHeight / scale.domainSpan;
  const ticks = generateDepthTicks({
    fromDepth: scale.fromDepth,
    toDepth: scale.toDepth,
    targetPixelSpacing: 42,
    pixelsPerMeter,
  });

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="depth-track"
      hitTest={({ depth }) => ({ kind: "depth", id: `depth:${depth.toFixed(2)}`, depth })}
    >
      {ticks.map((tick) => {
        return (
          <div
            key={tick.depth}
            className={`depth-mark ${tick.major ? "major" : "minor"}`}
            style={{ top: `${scale.depthToY(tick.depth)}px` }}
          >
            {tick.label}
          </div>
        );
      })}
    </TrackFrame>
  );
}
