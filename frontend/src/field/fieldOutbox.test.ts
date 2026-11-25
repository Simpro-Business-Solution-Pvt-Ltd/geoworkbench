import { describe, expect, it } from "vitest";

import type { MobileFieldSubmissionCreate } from "../api/types";
import {
  FIELD_OUTBOX_KEY,
  isConnectionError,
  isQuotaExceededError,
  newClientSubmissionId,
  newOutboxItem,
  outboxCapacityWarning,
  outboxLabel,
  outboxStorageBytes,
  readOutbox,
  writeOutbox,
  type OutboxItem,
} from "./fieldOutbox";

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

  it("stamps every queued item with a stable client id and device capture metadata", () => {
    const now = new Date("2026-10-03T03:00:00Z");
    const item = newOutboxItem(payload, "MGCA-08-PWA", now);
    expect(item.payload.client_submission_id).toBe(item.id);
    expect(item.payload.device_captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(typeof item.payload.device_timezone).toBe("string");
    // Resending the queued payload must carry the same id, so the server sees a replay.
    const resent = { ...item.payload };
    expect(resent.client_submission_id).toBe(item.payload.client_submission_id);
    expect(resent.device_captured_at).toBe(item.payload.device_captured_at);
  });

  it("keeps the capture offset consistent with the device clock", () => {
    const now = new Date("2026-10-03T03:00:00Z");
    const item = newOutboxItem(payload, "MGCA-08-PWA", now);
    const signed = (item.payload.device_captured_at ?? "").slice(-6);
    const offsetMinutes =
      (signed.startsWith("+") ? 1 : -1) * (Number(signed.slice(0, 3)) * 60 + Number(signed.slice(4)));
    expect(offsetMinutes).toBe(-now.getTimezoneOffset());
  });

  it("keeps the caller's client id and capture time instead of regenerating them", () => {
    const now = new Date("2026-10-03T03:00:00Z");
    const prepared = {
      ...payload,
      client_submission_id: "gw3-fixed-id",
      device_captured_at: "2026-10-03T08:30:00+05:30",
      device_timezone: "Asia/Kolkata",
    };
    const item = newOutboxItem(prepared, "MGCA-08-PWA", now);
    expect(item.payload.client_submission_id).toBe("gw3-fixed-id");
    expect(item.payload.device_captured_at).toBe("2026-10-03T08:30:00+05:30");
    expect(item.payload.device_timezone).toBe("Asia/Kolkata");
  });

  it("warns on storage capacity only near the soft limit", () => {
    expect(outboxCapacityWarning([])).toBeNull();
    expect(outboxStorageBytes([])).toBe(2);
    const item = newOutboxItem(payload, "MGCA-08-PWA");
    expect(outboxCapacityWarning([item])).toBeNull();
    const flood: OutboxItem[] = Array.from({ length: 4000 }, () => ({
      ...item,
      label: "x".repeat(1000),
    }));
    expect(outboxCapacityWarning(flood)).toMatch(/Device storage is filling up/);
  });

  it("recognizes quota errors and distinct client ids", () => {
    expect(isQuotaExceededError(new DOMException("full", "QuotaExceededError"))).toBe(true);
    expect(isQuotaExceededError(new TypeError("network"))).toBe(false);
    expect(newClientSubmissionId()).not.toBe(newClientSubmissionId());
  });
});
