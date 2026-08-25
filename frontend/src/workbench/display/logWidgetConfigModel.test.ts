import { describe, expect, it } from "vitest";

import type { Curve, DisplayWidget } from "../../api/types";
import {
  addCatalogTrackToLogWidget,
  addCurvesToLogWidget,
  cloneLogWidgetTrack,
  ensureCatalogTrackOnLogWidget,
  moveLogWidgetTrack,
  removeLogWidgetTrack,
} from "./logWidgetConfigModel";

describe("logWidgetConfigModel", () => {
  it("adds catalog tracks with unique ids", () => {
    const result = addCatalogTrackToLogWidget(logWidget([{ id: "lithology", type: "lithology", title: "Lithology", visible: true, width: 180 }]), "lithology");

    expect(result.status).toBe("changed");
    expect(result.widget.tracks?.map((track) => track.id)).toEqual(["lithology", "lithology-2"]);
  });

  it("adds a manually created curve track as an empty container", () => {
    const result = addCatalogTrackToLogWidget(logWidget([]), "curves", [curve("NGAM"), curve("RES")]);

    expect(result.status).toBe("changed");
    expect(result.widget.tracks?.[0]).toMatchObject({ type: "curve", title: "Curves" });
    expect(result.widget.tracks?.[0].curves).toEqual([]);
  });

  it("reveals an existing semantic track instead of adding a duplicate", () => {
    const result = ensureCatalogTrackOnLogWidget(
      logWidget([{ id: "my-rqd", type: "quantitativeBar", title: "RQD", visible: false, width: 100, valueField: "rqd" }]),
      "rqd",
    );

    expect(result.status).toBe("changed");
    expect(result.widget.tracks?.[0].visible).toBe(true);
    expect(result.widget.tracks).toHaveLength(1);
  });

  it("adds selected curves to the curve track only once", () => {
    const first = addCurvesToLogWidget(logWidget([]), [curve("NGAM")]);
    expect(first.status).toBe("changed");
    const second = addCurvesToLogWidget(first.widget, [curve("NGAM")]);

    expect(second.status).toBe("ignored");
    expect(first.widget.tracks?.[0].curves?.map((item) => item.curveKey)).toEqual(["NGAM"]);
  });

  it("clones, moves and removes tracks through pure operations", () => {
    const widget = logWidget([
      { id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 },
      { id: "lithology", type: "lithology", title: "Lithology", visible: true, width: 180 },
    ]);
    const cloned = cloneLogWidgetTrack(widget, "lithology");
    expect(cloned.widget.tracks?.map((track) => track.id)).toEqual(["depth", "lithology", "lithology-copy"]);

    const moved = moveLogWidgetTrack(cloned.widget, "lithology-copy", -1);
    expect(moved.widget.tracks?.map((track) => track.id)).toEqual(["depth", "lithology-copy", "lithology"]);

    const removed = removeLogWidgetTrack(moved.widget, "lithology-copy");
    expect(removed.widget.tracks?.map((track) => track.id)).toEqual(["depth", "lithology"]);
  });
});

function logWidget(tracks: DisplayWidget["tracks"]): DisplayWidget {
  return { type: "logWidget", title: "Borehole Log", tracks };
}

function curve(key: string): Curve {
  return {
    id: 1,
    key,
    label: key,
    unit: "API",
    source_type: "las",
    color: "#cc6633",
    samples: [
      { depth: 1, value: 40 },
      { depth: 2, value: 55 },
    ],
  };
}
