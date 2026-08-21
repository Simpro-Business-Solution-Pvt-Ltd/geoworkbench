import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";
import { addBottomDepthPadding, clampDepthWindow, inferLogWidgetDepthSpan, normalizeDepthSpan } from "./depthDomain";

describe("depthDomain", () => {
  it("normalizes reversed spans and adds bounded bottom padding", () => {
    expect(normalizeDepthSpan({ fromDepth: 20, toDepth: 10 })).toEqual({ fromDepth: 10, toDepth: 20 });
    expect(addBottomDepthPadding({ fromDepth: 0, toDepth: 600 })).toEqual({ fromDepth: 0, toDepth: 605 });
    expect(addBottomDepthPadding({ fromDepth: 0, toDepth: 4 }).toDepth).toBe(4.5);
  });

  it("uses the full borehole depth when the depth axis track is visible", () => {
    const span = inferLogWidgetDepthSpan(sampleWorkbench(), [{ id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 }]);

    expect(span).toEqual({ fromDepth: 0, toDepth: 604.3 });
  });

  it("infers the visible domain from configured data tracks when no depth axis is present", () => {
    const tracks: DisplayTrack[] = [
      { id: "lithology", type: "lithology", title: "Lithology", visible: true, width: 180 },
      { id: "core-images", type: "images", title: "Core Images", visible: true, width: 170 },
      {
        id: "curves",
        type: "curve",
        title: "Curves",
        visible: true,
        width: 260,
        curves: [{ curveKey: "gamma", label: "Gamma", unit: "API", color: "#aa6633", visible: true, scale: { mode: "manual", min: 0, max: 100 } }],
      },
    ];

    expect(inferLogWidgetDepthSpan(sampleWorkbench(), tracks)).toEqual({ fromDepth: 40, toDepth: 320 });
  });

  it("clamps visible windows inside the virtual domain", () => {
    expect(clampDepthWindow({ fromDepth: -10, toDepth: 120 }, { fromDepth: 0, toDepth: 100 })).toEqual({
      fromDepth: 0,
      toDepth: 100,
    });
    expect(clampDepthWindow({ fromDepth: 40, toDepth: 60 }, { fromDepth: 0, toDepth: 100 })).toEqual({
      fromDepth: 40,
      toDepth: 60,
    });
  });
});

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "PBH-01",
    title: "PBH-01",
    state: null,
    total_depth: 604.3,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "draft",
    attributes: null,
    layout: null,
    lithology_intervals: [
      {
        id: "1",
        source_row: null,
        from_depth: 250,
        to_depth: 320,
        lithology_code: "COAL",
        lithology_label: "Coal",
        display_color: null,
        logged_color: null,
        seam_name: "A",
        recovery: null,
        recovery_percent: null,
        rqd: null,
        structural_features: null,
        remark: null,
        image_box: null,
        image_file: null,
      },
    ],
    seam_intervals: [],
    core_images: [
      {
        box_number: 1,
        name: "Box 1",
        file_path: "box1.jpg",
        from_depth: 40,
        to_depth: 44,
        url: "/box1.jpg",
        original_url: "/box1.jpg",
        strip_url: null,
        image_metadata: null,
      },
    ],
    curves: [
      {
        id: 1,
        key: "gamma",
        label: "Gamma",
        unit: "API",
        source_type: "las",
        color: "#aa6633",
        samples: [
          { depth: 260, value: 50 },
          { depth: 280, value: 55 },
        ],
      },
    ],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
