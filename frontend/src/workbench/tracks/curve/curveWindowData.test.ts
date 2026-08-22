import { describe, expect, it } from "vitest";

import type { Curve, CurveSampleWindow, DisplayTrack } from "../../../api/types";
import {
  applyCurveSampleWindow,
  curveWindowQueryIdentity,
  curveWindowQueryKey,
  resolveConfiguredCurves,
  shouldUseWindowedCurveSamples,
} from "./curveWindowData";

describe("curveWindowData", () => {
  it("keeps windowed curve samples explicitly opt-in", () => {
    expect(shouldUseWindowedCurveSamples(track())).toBe(false);
    expect(shouldUseWindowedCurveSamples(track({ renderer: { sampleSource: "visible-window" } }))).toBe(true);
  });

  it("builds a stable rounded query identity for visible depth", () => {
    const identity = curveWindowQueryIdentity(
      10,
      "gamma",
      { fromDepth: 12.12345, toDepth: 28.98765 },
      1500,
    );

    expect(identity).toEqual({
      boreholeId: 10,
      curveKey: "gamma",
      fromDepth: 12.123,
      toDepth: 28.988,
      maxSamples: 1500,
    });
    expect(curveWindowQueryKey(identity)).toEqual(["curveSamples", 10, "gamma", 12.123, 28.988, 1500]);
  });

  it("applies matching window samples without losing curve metadata", () => {
    const curve = gammaCurve();

    const updated = applyCurveSampleWindow(curve, window());

    expect(updated.samples).toEqual([{ depth: 10, value: 42 }]);
    expect(updated.curve_metadata?.source).toBe("las");
    expect(updated.curve_metadata?.window_samples).toMatchObject({
      from_depth: 9,
      to_depth: 11,
      returned_sample_count: 1,
    });
  });

  it("resolves configured curves with available windows", () => {
    const curves = resolveConfiguredCurves(
      [gammaCurve(), densityCurve()],
      [
        curveConfig("gamma"),
        curveConfig("density"),
        curveConfig("missing"),
      ],
      new Map([["gamma", window()]]),
    );

    expect(curves.map((item) => item.curve.key)).toEqual(["gamma", "density"]);
    expect(curves[0].curve.samples).toEqual([{ depth: 10, value: 42 }]);
    expect(curves[1].curve.samples).toEqual([{ depth: 0, value: 2.1 }]);
  });
});

function track(overrides: Partial<DisplayTrack> = {}): DisplayTrack {
  return {
    id: "curve-track",
    type: "curve",
    title: "Curves",
    visible: true,
    width: 200,
    curves: [curveConfig("gamma")],
    ...overrides,
  };
}

function curveConfig(curveKey: string): NonNullable<DisplayTrack["curves"]>[number] {
  return {
    curveKey,
    label: curveKey,
    unit: "API",
    color: "#d97706",
    visible: true,
    scale: { mode: "linear", min: 0, max: 100 },
  };
}

function gammaCurve(): Curve {
  return {
    id: 1,
    key: "gamma",
    label: "Gamma",
    unit: "API",
    source_type: "las",
    color: "#d97706",
    curve_metadata: { source: "las" },
    samples: [{ depth: 0, value: 35 }],
  };
}

function densityCurve(): Curve {
  return {
    id: 2,
    key: "density",
    label: "Density",
    unit: "g/cc",
    source_type: "las",
    color: "#2563eb",
    curve_metadata: null,
    samples: [{ depth: 0, value: 2.1 }],
  };
}

function window(): CurveSampleWindow {
  return {
    borehole_id: 10,
    curve_id: 1,
    key: "gamma",
    from_depth: 9,
    to_depth: 11,
    full_sample_count: 100,
    window_sample_count: 1,
    returned_sample_count: 1,
    display_mode: "window_full",
    samples: [{ depth: 10, value: 42 }],
  };
}
