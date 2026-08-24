import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, DisplayWidget } from "../../api/types";
import { resolveLogWidgetDrop } from "./logWidgetDropResolver";

describe("logWidgetDropResolver", () => {
  it("adds a dropped curve to an existing curve track", () => {
    const widget = logWidget([
      {
        id: "curves",
        type: "curve",
        title: "Curves",
        visible: true,
        width: 260,
        curves: [],
      },
    ]);

    const result = resolveLogWidgetDrop(widget, { scope: "borehole", kind: "curve", curveKey: "NGAM" }, sampleWorkbench());

    expect(result.status).toBe("changed");
    expect(result.widget.tracks?.[0].curves?.map((curve) => curve.curveKey)).toEqual(["NGAM"]);
  });

  it("creates a curve track when none exists", () => {
    const result = resolveLogWidgetDrop(
      logWidget([{ id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 }]),
      { scope: "borehole", kind: "curve", curveKey: "NGAM" },
      sampleWorkbench(),
    );

    expect(result.status).toBe("changed");
    expect(result.widget.tracks?.some((track) => track.type === "curve")).toBe(true);
  });

  it("maps interval fields to suitable track types", () => {
    const result = resolveLogWidgetDrop(
      logWidget([]),
      { scope: "borehole", kind: "intervalField", field: "rqd", unit: "%" },
      sampleWorkbench(),
    );

    expect(result.status).toBe("changed");
    expect(result.widget.tracks?.[0]).toMatchObject({ type: "quantitativeBar", valueField: "rqd" });
  });

  it("ignores duplicate curve drops", () => {
    const result = resolveLogWidgetDrop(
      logWidget([
        {
          id: "curves",
          type: "curve",
          title: "Curves",
          visible: true,
          width: 260,
          curves: [
            {
              curveKey: "NGAM",
              label: "Natural Gamma",
              unit: "API",
              color: "#c43",
              visible: true,
              scale: { mode: "manual", min: 0, max: 100 },
            },
          ],
        },
      ]),
      { scope: "borehole", kind: "curve", curveKey: "NGAM" },
      sampleWorkbench(),
    );

    expect(result.status).toBe("ignored");
  });
});

function logWidget(tracks: DisplayWidget["tracks"]): DisplayWidget {
  return {
    type: "logWidget",
    title: "Borehole Log",
    tracks,
  };
}

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "PBH-62",
    title: "PBH 62",
    state: "active",
    total_depth: 120,
    closure_note: null,
    source_workbook: null,
    source_sheet: null,
    workflow_status: "review",
    lithology_intervals: [],
    seam_intervals: [],
    curves: [
      {
        id: 1,
        key: "NGAM",
        label: "Natural Gamma",
        unit: "API",
        source_type: "LAS",
        color: "#c43",
        samples: [
          { depth: 1, value: 32 },
          { depth: 2, value: 48 },
        ],
      },
    ],
    core_images: [],
    layout: null,
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
