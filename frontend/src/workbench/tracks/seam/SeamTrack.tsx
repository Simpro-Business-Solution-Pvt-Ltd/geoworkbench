import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import { depthIsInsideInterval } from "../../core/depthVisibility";
import type { LogTrackContext } from "../../core/logTrackContext";
import { numericRendererSetting } from "../../core/rendererSettings";
import { TrackFrame } from "../../core/TrackFrame";
import { buildSeamRenderModels } from "./seamRenderModel";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

const DEFAULT_LABEL_MIN_HEIGHT_PX = 18;

export function SeamTrack({ data, track, context }: Props) {
  const { scale, visibleDepthSpan } = context;
  const labelMinHeightPx = numericRendererSetting(track, "labelMinHeightPx", DEFAULT_LABEL_MIN_HEIGHT_PX);
  const seamModels = buildSeamRenderModels(data.seam_intervals, scale, visibleDepthSpan, { labelMinHeightPx });

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
      {seamModels
        .map((model) => {
          return (
            <div
              className="seam-marker"
              key={model.key}
              style={model.style}
              title={model.title}
            >
              {model.showLabel && <span>{model.seam.name}</span>}
            </div>
          );
        })}
    </TrackFrame>
  );
}
