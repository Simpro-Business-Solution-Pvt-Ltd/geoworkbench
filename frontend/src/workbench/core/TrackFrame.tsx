import { type MouseEvent, type ReactNode } from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";
import { resolveTrackPointerPosition } from "./logViewport";
import type { LogTrackContext } from "./logTrackContext";
import type { DepthScale } from "./depthScale";
import { emptyTrackObject, type TrackObject, type TrackPointerEvent } from "./trackObject";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context?: LogTrackContext;
  scale?: DepthScale;
  children: ReactNode;
  headerDetail?: ReactNode;
  className?: string;
  widthStyle?: number | string;
  hitTest?: (args: { depth: number; localX: number; localY: number }) => TrackObject | null;
  onTrackEvent?: (event: TrackPointerEvent) => void;
};

export function TrackFrame({
  data,
  track,
  context,
  scale: explicitScale,
  children,
  headerDetail,
  className,
  widthStyle,
  hitTest,
  onTrackEvent: explicitOnTrackEvent,
}: Props) {
  const scale = context?.scale ?? explicitScale;
  const onTrackEvent = context?.dispatchTrackEvent ?? explicitOnTrackEvent;
  const resolvedWidth = context ? context.widthForTrack(track) : (widthStyle ?? track.width);

  function emit(type: TrackPointerEvent["type"], event: MouseEvent<HTMLDivElement>) {
    if (!scale || !onTrackEvent) return;
    if ((event.target as HTMLElement).closest(".track-title")) return;
    const body = event.currentTarget.querySelector<HTMLElement>(".track-body");
    const bounds = body?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const pointer = resolveTrackPointerPosition(scale, event.clientY, bounds.top);
    const localY = pointer.contentY;
    const depth = pointer.depth;
    const object = hitTest?.({ depth, localX, localY }) ?? emptyTrackObject(depth);
    onTrackEvent({
      type,
      trackId: track.id,
      trackType: track.type,
      depth,
      localX,
      localY,
      object,
      nativeEvent: event,
    });
  }

  return (
    <div
      className={`track ${className ?? ""}`}
      data-track-id={track.id}
      data-track-type={track.type}
      style={{ width: resolvedWidth }}
      onMouseDown={(event) => {
        if (event.button === 0) emit("dragstart", event);
      }}
      onMouseMove={(event) => emit(event.buttons === 1 ? "drag" : "hover", event)}
      onMouseUp={(event) => {
        if (event.button === 0) emit("dragend", event);
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        emit("contextmenu", event);
      }}
    >
      <div className="track-title">
        <span className="track-title-text" title={track.title}>
          {track.title}
        </span>
        {headerDetail}
      </div>
      <div className="track-body">{children}</div>
      <span className="sr-only">{data.code}</span>
    </div>
  );
}
