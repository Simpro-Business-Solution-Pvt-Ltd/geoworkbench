import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench, DisplayWidget } from "../../../api/types";
import { withRuntimeLogWidget } from "./runtimeLogWidgetModel";

describe("withRuntimeLogWidget", () => {
  it("keeps the original workbench reference for the primary log widget", () => {
    const data = sampleWorkbench();

    expect(withRuntimeLogWidget(data, "log-widget", { type: "logWidget", title: "Primary" })).toBe(data);
  });

  it("maps cloned log widgets into the canonical runtime log-widget slot", () => {
    const data = sampleWorkbench();
    const clonedWidget: DisplayWidget = {
      type: "logWidget",
      title: "Correlation Log",
      tracks: [{ id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 80 }],
    };
    const runtimeData = withRuntimeLogWidget(data, "log-widget-copy", clonedWidget);

    expect(runtimeData).not.toBe(data);
    expect(runtimeData.layout?.settings.widgets?.["log-widget"]).toEqual(clonedWidget);
    expect(data.layout?.settings.widgets?.["log-widget"].title).toBe("Original Log");
  });

  it("leaves workbench data unchanged when no layout is available", () => {
    const data = { ...sampleWorkbench(), layout: null };

    expect(withRuntimeLogWidget(data, "log-widget-copy", { type: "logWidget", title: "Copy" })).toBe(data);
  });
});

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "TEST",
    title: "Test",
    state: null,
    total_depth: 100,
    source_workbook: null,
    source_sheet: null,
    closure_note: null,
    workflow_status: "draft",
    attributes: null,
    layout: {
      id: 1,
      name: "Default",
      mode: "runtime",
      settings: {
        widgets: {
          "log-widget": { type: "logWidget", title: "Original Log" },
        },
      },
    },
    lithology_intervals: [],
    seam_intervals: [],
    core_images: [],
    curves: [],
    validation_issues: [],
    ai_suggestions: [],
    source_imports: [],
    field_submissions: [],
    source_files: [],
  };
}
