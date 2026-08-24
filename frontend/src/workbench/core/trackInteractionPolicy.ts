import type { DisplayTrack } from "../../api/types";
import type { TrackObject, TrackPointerEventType } from "./trackObject";

export function shouldEmitTrackPointerEvent(track: DisplayTrack, type: TrackPointerEventType): boolean {
  if (type === "contextmenu") return track.interaction?.contextMenuEnabled !== false;
  if (type === "dragstart" || type === "drag" || type === "dragend") {
    return track.interaction?.selectable !== false;
  }
  return true;
}

export function objectForTrackPointerEvent(
  track: DisplayTrack,
  type: TrackPointerEventType,
  object: TrackObject,
  fallback: TrackObject,
): TrackObject {
  if (type === "hover" && track.interaction?.tooltipEnabled === false) return fallback;
  return object;
}
