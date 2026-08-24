import { type MouseEvent, type ReactNode } from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";
import type { LogTrackContext } from "./logTrackContext";
import type { DepthScale } from "./depthScale";
import { emptyTrackObject, type TrackObject, type TrackPointerEvent } from "./trackObject";
import { objectForTrackPointerEvent, shouldEmitTrackPointerEvent } from "./trackInteractionPolicy";
import { isTrackHeaderTarget, resolveTrackPointerFromClient } from "./trackPointerMapping";

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
    if (isTrackHeaderTarget(event.target)) return;
    if (!shouldEmitTrackPointerEvent(track, type)) return;
    const body = event.currentTarget.querySelector<HTMLElement>(".track-body");
    const bounds = body?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const { localX, localY, depth } = resolveTrackPointerFromClient(
      scale,
      event.clientX,
      event.clientY,
      bounds,
    );
    const fallbackObject = emptyTrackObject(depth);
    const hitObject = hitTest?.({ depth, localX, localY }) ?? fallbackObject;
    const object = objectForTrackPointerEvent(track, type, hitObject, fallbackObject);
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
