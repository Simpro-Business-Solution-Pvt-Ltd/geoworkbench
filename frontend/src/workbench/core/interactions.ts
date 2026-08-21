import type { TrackPointerEvent } from "./trackObject";
import type { WorkbenchActions } from "../display/workbenchStore";

export function handleTrackPointerEvent(event: TrackPointerEvent, actions: WorkbenchActions) {
  if (event.type === "hover") {
    if (event.object.kind === "curve-sample") {
      actions.setHoveredObject(event.object);
    } else {
      actions.setHoveredObject(null);
    }
    return;
  }

  if (event.type === "click") {
    if (shouldPromoteDepthSelection(event)) {
      actions.setSelectedDepth(event.depth);
    }

    if (event.object.kind === "depth") {
      return;
    }
    if (event.object.kind === "lithology-interval") {
      actions.setSelectedInterval(event.object.interval);
      return;
    }
    if (event.object.kind === "curve-sample") {
      actions.setHoveredObject(event.object);
      return;
    }
    if (event.object.kind === "core-image") {
      actions.setSelectedImage(event.object.image);
      return;
    }
    if (event.object.kind === "remark-group") {
      actions.setSelectedRemarkGroup(event.object);
      return;
    }
    if (event.object.kind === "ai-suggestion-group") {
      actions.setSelectedAiSuggestion(event.object.suggestions[0] ?? null);
      return;
    }
  }

  if (event.type === "contextmenu") {
    if (shouldPromoteDepthSelection(event)) {
      actions.setSelectedDepth(event.depth);
    }
    actions.setContextMenu({
      trackId: event.trackId,
      trackType: event.trackType,
      depth: event.depth,
      object: event.object,
      x: event.nativeEvent.clientX,
      y: event.nativeEvent.clientY,
    });
  }
}

function shouldPromoteDepthSelection(event: TrackPointerEvent) {
  return event.object.kind === "depth" || event.object.kind === "lithology-interval";
}
