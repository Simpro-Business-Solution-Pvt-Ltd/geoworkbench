import { describe, expect, it } from "vitest";

import type { MobileFieldSubmissionCreate } from "../api/types";
import { FIELD_OUTBOX_KEY, isConnectionError, newOutboxItem, outboxLabel, readOutbox, writeOutbox } from "./fieldOutbox";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const payload: MobileFieldSubmissionCreate = {
  borehole_id: 17,
  lithology_intervals: [
    {
      from_depth: 42,
      to_depth: 42.11,
      lithology_code: "SHCOAL",
      lithology_label: "SHALY COAL",
      logged_color: null,
      seam_name: "LK-1-BOT",
      recovery: 0.1,
      recovery_percent: 90.9,
      rqd: null,
      structural_features: null,
      remark: "Captured offline",
    },
  ],
  runtime_parameters: [],
};

describe("field outbox", () => {
  it("survives a reload: what is written can be read back", () => {
    const storage = memoryStorage();
    const item = newOutboxItem(payload, "MGCA-08-PWA", new Date("2026-10-03T08:00:00Z"));
    writeOutbox(storage, [item]);
    expect(readOutbox(storage)).toEqual([item]);
    expect(item).toMatchObject({ boreholeId: 17, boreholeCode: "MGCA-08-PWA", label: "42-42.11 m SHCOAL", state: "waiting" });
  });

  it("ignores corrupt or foreign storage instead of crashing", () => {
    expect(readOutbox(memoryStorage({ [FIELD_OUTBOX_KEY]: "not json" }))).toEqual([]);
    expect(readOutbox(memoryStorage({ [FIELD_OUTBOX_KEY]: JSON.stringify([{ id: 1 }, null]) }))).toEqual([]);
    expect(readOutbox(memoryStorage())).toEqual([]);
  });

  it("labels an interval by depth and code", () => {
    expect(outboxLabel(payload)).toBe("42-42.11 m SHCOAL");
    expect(outboxLabel({ ...payload, lithology_intervals: [] })).toBe("Interval");
  });

  it("treats offline and failed fetches as connection errors, server replies as not", () => {
    expect(isConnectionError(new Error("anything"), false)).toBe(true);
    expect(isConnectionError(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(isConnectionError(new Error("422 Unprocessable"), true)).toBe(false);
  });
});
