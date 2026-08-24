import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { numericRendererSetting } from "../../core/rendererSettings";
import { TrackFrame } from "../../core/TrackFrame";
import { buildDepthTickRenderModels } from "./depthRenderModel";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function DepthTrack({ data, track, context }: Props) {
  const { scale } = context;
  const targetPixelSpacing = numericRendererSetting(track, "targetTickPixelSpacing", 42);
  const ticks = buildDepthTickRenderModels(scale, { targetPixelSpacing });

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="depth-track"
      hitTest={({ depth }) => ({ kind: "depth", id: `depth:${depth.toFixed(2)}`, depth })}
    >
      {ticks.map((tick) => (
        <div
          key={tick.key}
          className={tick.className}
          style={tick.style}
        >
          {tick.label}
        </div>
      ))}
    </TrackFrame>
  );
}
