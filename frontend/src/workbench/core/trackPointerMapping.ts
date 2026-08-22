import type { DepthScale } from "./depthScale";
import { resolveTrackPointerPosition } from "./logViewport";

export type TrackPointerBounds = {
  left: number;
  top: number;
};

export type ResolvedTrackPointer = {
  localX: number;
  localY: number;
  depth: number;
};

export function resolveTrackPointerFromClient(
  scale: DepthScale,
  clientX: number,
  clientY: number,
  bounds: TrackPointerBounds,
): ResolvedTrackPointer {
  const pointer = resolveTrackPointerPosition(scale, clientY, bounds.top);
  return {
    localX: clientX - bounds.left,
    localY: pointer.contentY,
    depth: pointer.depth,
  };
}

export function isTrackHeaderTarget(target: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    Boolean(target.closest(".track-title"))
  );
}
