// Device-side outbox for field intervals. An interval synced without a connection is kept
// here (browser storage), so closing or reloading the app no longer loses it. Items leave
// the outbox only after the server confirms them.

import type { MobileFieldSubmissionCreate } from "../api/types";

export const FIELD_OUTBOX_KEY = "geoworkbench.field.outbox.v1";

export type OutboxItem = {
  id: string;
  boreholeId: number;
  boreholeCode: string | null;
  /** Short description for the list, e.g. "42-42.11 m SHCOAL". */
  label: string;
  queuedAt: string;
  payload: MobileFieldSubmissionCreate;
  /** "waiting" = not sent yet; "rejected" = the server refused it (kept for the user to review). */
  state: "waiting" | "rejected";
  lastError?: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readOutbox(storage: StorageLike): OutboxItem[] {
  try {
    const parsed = JSON.parse(storage.getItem(FIELD_OUTBOX_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isOutboxItem) : [];
  } catch {
    return [];
  }
}

export function writeOutbox(storage: StorageLike, items: OutboxItem[]): void {
  storage.setItem(FIELD_OUTBOX_KEY, JSON.stringify(items));
}

export function outboxLabel(payload: MobileFieldSubmissionCreate): string {
  const interval = payload.lithology_intervals[0];
  if (!interval) return "Interval";
  const code = interval.lithology_code ? ` ${interval.lithology_code}` : "";
  return `${interval.from_depth}-${interval.to_depth} m${code}`;
}

export function newOutboxItem(
  payload: MobileFieldSubmissionCreate,
  boreholeCode: string | null,
  now: Date = new Date(),
): OutboxItem {
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    boreholeId: payload.borehole_id,
    boreholeCode,
    label: outboxLabel(payload),
    queuedAt: now.toISOString(),
    payload,
    state: "waiting",
  };
}

/**
 * True when a request failed because there was no connection (fetch could not reach the
 * server), as opposed to the server answering with an error. Only the first kind is queued.
 */
export function isConnectionError(error: unknown, online: boolean): boolean {
  if (!online) return true;
  return error instanceof TypeError;
}

function isOutboxItem(value: unknown): value is OutboxItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Partial<OutboxItem>;
  return (
    typeof item.id === "string" &&
    typeof item.boreholeId === "number" &&
    typeof item.label === "string" &&
    typeof item.payload === "object" &&
    item.payload !== null &&
    (item.state === "waiting" || item.state === "rejected")
  );
}
