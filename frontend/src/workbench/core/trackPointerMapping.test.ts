import { afterEach, describe, expect, it, vi } from "vitest";

import { createDepthScale } from "./depthScale";
import { isTrackHeaderTarget, resolveTrackPointerFromClient } from "./trackPointerMapping";

describe("trackPointerMapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps client coordinates into track-local x, content y, and depth", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    const pointer = resolveTrackPointerFromClient(scale, 175, 170, { left: 25, top: 70 });

    expect(pointer.localX).toBe(150);
    expect(pointer.localY).toBe(100);
    expect(pointer.depth).toBeCloseTo(50, 4);
  });

  it("clamps vertical coordinates to the drawable depth body", () => {
    const scale = createDepthScale(100, 240, 40, 0, 100, 0, 100);

    expect(resolveTrackPointerFromClient(scale, 0, 20, { left: 0, top: 70 }).depth).toBe(0);
    expect(resolveTrackPointerFromClient(scale, 0, 500, { left: 0, top: 70 }).depth).toBe(100);
  });

  it("detects events coming from a track header", () => {
    class FakeElement extends EventTarget {
      constructor(private readonly match: boolean) {
        super();
      }

      closest(selector: string) {
        return this.match && selector === ".track-title" ? this : null;
      }
    }
    vi.stubGlobal("HTMLElement", FakeElement);

    expect(isTrackHeaderTarget(new FakeElement(true))).toBe(true);
    expect(isTrackHeaderTarget(new FakeElement(false))).toBe(false);
    expect(isTrackHeaderTarget(null)).toBe(false);
  });
});
