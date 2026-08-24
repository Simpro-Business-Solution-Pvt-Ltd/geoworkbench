import { describe, expect, it } from "vitest";

import { queryKeysForWorkbenchEvent, type WorkbenchRealtimeEvent } from "./workbenchRealtime";
import { parseWorkbenchRealtimeEvent } from "./useWorkbenchRealtime";

describe("workbench realtime", () => {
  it("parses valid workbench events", () => {
    const event = parseWorkbenchRealtimeEvent(
      JSON.stringify({
        type: "workbench.interval.updated",
        borehole_id: 12,
        entity: "lithology_interval",
        operation: "updated",
        payload: { interval_id: "x" },
        occurred_at: "2026-08-22T00:00:00Z",
      }),
    );

    expect(event?.type).toBe("workbench.interval.updated");
    expect(event?.borehole_id).toBe(12);
    expect(event?.payload.interval_id).toBe("x");
  });

  it("ignores invalid event payloads", () => {
    expect(parseWorkbenchRealtimeEvent("not json")).toBeNull();
    expect(parseWorkbenchRealtimeEvent(JSON.stringify({ borehole_id: 12 }))).toBeNull();
  });

  it("invalidates core workbench queries for borehole events", () => {
    const keys = queryKeysForWorkbenchEvent(event({ type: "workbench.interval.updated", entity: "lithology_interval" }));

    expect(keys).toContainEqual(["workbench", 12]);
    expect(keys).toContainEqual(["aiSummary", 12]);
    expect(keys).toContainEqual(["exportReadiness", 12]);
    expect(keys).toContainEqual(["exportJobs", 12]);
  });

  it("invalidates borehole lists for mobile and source-file events", () => {
    expect(queryKeysForWorkbenchEvent(event({ type: "workbench.mobile.field_submission", entity: "field_submission" }))).toContainEqual([
      "boreholes",
    ]);
    expect(queryKeysForWorkbenchEvent(event({ type: "workbench.source_file.merged", entity: "source_file" }))).toContainEqual([
      "boreholes",
    ]);
  });

  it("invalidates curve sample windows for curve and import events", () => {
    expect(queryKeysForWorkbenchEvent(event({ type: "workbench.curve.updated", entity: "curve" }))).toContainEqual([
      "curveSamples",
      12,
    ]);
    expect(queryKeysForWorkbenchEvent(event({ type: "workbench.source_file.merged", entity: "source_file" }))).toContainEqual([
      "curveSamples",
      12,
    ]);
  });

  it("invalidates template profile queries for profile update events", () => {
    expect(queryKeysForWorkbenchEvent(event({ type: "workbench.import_profile.updated", entity: "import_profile" }))).toContainEqual([
      "importProfiles",
    ]);
    expect(queryKeysForWorkbenchEvent(event({ type: "workbench.export_profile.updated", entity: "export_profile" }))).toContainEqual([
      "exportProfiles",
    ]);
  });
});

function event(overrides: Partial<WorkbenchRealtimeEvent>): WorkbenchRealtimeEvent {
  return {
    type: "workbench.interval.updated",
    borehole_id: 12,
    entity: "lithology_interval",
    operation: "updated",
    payload: {},
    occurred_at: "2026-08-22T00:00:00Z",
    ...overrides,
  };
}
