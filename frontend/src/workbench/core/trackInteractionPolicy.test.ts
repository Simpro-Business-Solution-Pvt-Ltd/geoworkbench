import { describe, expect, it } from "vitest";

import type { DisplayTrack } from "../../api/types";
import { objectForTrackPointerEvent, shouldEmitTrackPointerEvent } from "./trackInteractionPolicy";
import type { TrackObject } from "./trackObject";

describe("trackInteractionPolicy", () => {
  it("respects context menu and selectable settings", () => {
    const track = displayTrack({
      interaction: { contextMenuEnabled: false, selectable: false },
    });

    expect(shouldEmitTrackPointerEvent(track, "contextmenu")).toBe(false);
    expect(shouldEmitTrackPointerEvent(track, "dragstart")).toBe(false);
    expect(shouldEmitTrackPointerEvent(track, "drag")).toBe(false);
    expect(shouldEmitTrackPointerEvent(track, "dragend")).toBe(false);
    expect(shouldEmitTrackPointerEvent(track, "hover")).toBe(true);
  });

  it("keeps hover depth but suppresses tooltip objects when disabled", () => {
    const track = displayTrack({ interaction: { tooltipEnabled: false } });
    const hit: TrackObject = { kind: "curve-sample", id: "curve", depth: 10 } as TrackObject;
    const fallback: TrackObject = { kind: "empty", id: "empty:10", depth: 10 };

    expect(objectForTrackPointerEvent(track, "hover", hit, fallback)).toBe(fallback);
    expect(objectForTrackPointerEvent(track, "dragend", hit, fallback)).toBe(hit);
  });
});

function displayTrack(overrides: Partial<DisplayTrack> = {}): DisplayTrack {
  return {
    id: "track",
    type: "curve",
    title: "Track",
    visible: true,
    width: 120,
    ...overrides,
  };
}
