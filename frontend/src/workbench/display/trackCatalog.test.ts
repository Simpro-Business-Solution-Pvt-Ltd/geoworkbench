import { describe, expect, it } from "vitest";

import type { Curve, DisplayTrack } from "../../api/types";
import { createTrackId, defaultScaleForCurve, defaultTracks, syncTrackCurves } from "./trackCatalog";

describe("trackCatalog", () => {
  it("creates default tracks with geophysical curves and the core image track", () => {
    const tracks = defaultTracks([curve("res", "Resistivity", [10, 20]), curve("ngamma", "Natural Gamma", [50])]);
    const curveTrack = tracks.find((track) => track.type === "curve");

    expect(tracks.some((track) => track.id === "core-images")).toBe(true);
    expect(curveTrack?.curves?.map((item) => item.curveKey)).toEqual(["ngamma", "res"]);
    expect(curveTrack?.curves?.[0].tooltipEnabled).toBe(true);
  });

  it("fills missing curve display settings without changing configured curve order", () => {
    const track: DisplayTrack = {
      id: "curves",
      type: "curve",
      title: "Curves",
      visible: true,
      width: 260,
      curves: [{ curveKey: "res", label: "", unit: "", color: "", visible: true, scale: undefined as never }],
    };
    const [synced] = syncTrackCurves([track], [curve("res", "Resistivity", [12, 18]), curve("ngamma", "Natural Gamma", [40])]);

    expect(synced.curves?.map((item) => item.curveKey)).toEqual(["res"]);
    expect(synced.curves?.[0]).toMatchObject({
      label: "Resistivity",
      unit: "ohm-m",
      color: "#3366aa",
      tooltipEnabled: true,
      lineStyle: "solid",
      scale: { mode: "manual", min: 12, max: 18 },
    });
  });

  it("creates stable unique track ids and default scales", () => {
    expect(createTrackId("curves", new Set(["curves", "curves-2"]))).toBe("curves-3");
    expect(defaultScaleForCurve(curve("empty", "Empty", [])).max).toBe(100);
  });
});

function curve(key: string, label: string, values: number[]): Curve {
  return {
    id: values.length + key.length,
    key,
    label,
    unit: key === "res" ? "ohm-m" : "API",
    source_type: "las",
    color: key === "res" ? "#3366aa" : "#aa6633",
    samples: values.map((value, index) => ({ depth: index, value })),
  };
}
