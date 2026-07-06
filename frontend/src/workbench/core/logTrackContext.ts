import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";
import type { DepthSpan } from "./depthDomain";
import type { DepthScale } from "./depthScale";
import type { TrackPointerEvent } from "./trackObject";

export type LogTrackContext = {
  data: BoreholeWorkbench;
  scale: DepthScale;
  depthDomain: DepthSpan;
  visibleDepthSpan: DepthSpan;
  widthForTrack: (track: DisplayTrack) => string;
  dispatchTrackEvent: (event: TrackPointerEvent) => void;
};
