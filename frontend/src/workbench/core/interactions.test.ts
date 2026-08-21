import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleTrackPointerEvent } from "./interactions";
import type { TrackObject, TrackPointerEvent } from "./trackObject";
import type { WorkbenchActions } from "../display/workbenchStore";

function actions(): WorkbenchActions {
  return {
    setSelectedInterval: vi.fn(),
    setSelectedDepth: vi.fn(),
    setSelectedImage: vi.fn(),
    setSelectedRemarkGroup: vi.fn(),
    setSelectedAiSuggestion: vi.fn(),
    setHoveredObject: vi.fn(),
    setContextMenu: vi.fn(),
    setTooltipsEnabled: vi.fn(),
    setMode: vi.fn(),
  };
}

function pointerEvent(object: TrackObject, type: TrackPointerEvent["type"] = "click"): TrackPointerEvent {
  return {
    type,
    trackId: "track-1",
    trackType: "depth",
    depth: object.depth,
    localX: 12,
    localY: 34,
    object,
    nativeEvent: { clientX: 100, clientY: 200 } as TrackPointerEvent["nativeEvent"],
  };
}

describe("handleTrackPointerEvent", () => {
  let workbenchActions: WorkbenchActions;

  beforeEach(() => {
    workbenchActions = actions();
  });

  it("promotes depth clicks to the selected depth", () => {
    handleTrackPointerEvent(pointerEvent({ kind: "depth", id: "depth:120", depth: 120 }), workbenchActions);

    expect(workbenchActions.setSelectedDepth).toHaveBeenCalledWith(120);
  });

  it("promotes lithology clicks and opens interval details", () => {
    const interval = { id: "interval-1", from_depth: 10, to_depth: 12 } as never;

    handleTrackPointerEvent(
      pointerEvent({ kind: "lithology-interval", id: "interval-1", depth: 10.5, interval }),
      workbenchActions,
    );

    expect(workbenchActions.setSelectedDepth).toHaveBeenCalledWith(10.5);
    expect(workbenchActions.setSelectedInterval).toHaveBeenCalledWith(interval);
  });

  it("opens core images without overriding the selected depth", () => {
    const image = { id: "image-1", from_depth: 20, to_depth: 21 } as never;

    handleTrackPointerEvent(pointerEvent({ kind: "core-image", id: "image-1", depth: 20.5, image }), workbenchActions);

    expect(workbenchActions.setSelectedDepth).not.toHaveBeenCalled();
    expect(workbenchActions.setSelectedImage).toHaveBeenCalledWith(image);
  });

  it("opens remark groups without overriding the selected depth", () => {
    const object: TrackObject = {
      kind: "remark-group",
      id: "remarks:30",
      depth: 30,
      remarks: [{ depth: 30, text: "broken core", sourceRow: 42 }],
    };

    handleTrackPointerEvent(pointerEvent(object), workbenchActions);

    expect(workbenchActions.setSelectedDepth).not.toHaveBeenCalled();
    expect(workbenchActions.setSelectedRemarkGroup).toHaveBeenCalledWith(object);
  });

  it("opens ai suggestions without overriding the selected depth", () => {
    const suggestion = { id: "suggestion-1", from_depth: 50, to_depth: 51 } as never;

    handleTrackPointerEvent(
      pointerEvent({
        kind: "ai-suggestion-group",
        id: "ai:50",
        depth: 50,
        suggestions: [suggestion],
      }),
      workbenchActions,
    );

    expect(workbenchActions.setSelectedDepth).not.toHaveBeenCalled();
    expect(workbenchActions.setSelectedAiSuggestion).toHaveBeenCalledWith(suggestion);
  });

  it("keeps context-menu depth local to the menu for curve samples", () => {
    const object = {
      kind: "curve-sample",
      id: "curve:GR:40",
      depth: 40,
      curve: {},
      sample: {},
      distance: 0,
      screenXPercent: 50,
      screenYPercent: 10,
    } as TrackObject;

    handleTrackPointerEvent(pointerEvent(object, "contextmenu"), workbenchActions);

    expect(workbenchActions.setSelectedDepth).not.toHaveBeenCalled();
    expect(workbenchActions.setContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 40, object }),
    );
  });
});
