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

/**
 * Device capture metadata for an outbox item: the wall-clock moment the geologist
 * captured the data (with the local UTC offset, so "09:30 IST" stays readable on any
 * machine) and the device timezone. The server records its own receipt time separately.
 */
export function deviceCaptureMetadata(now: Date = new Date()): {
  device_captured_at: string;
  device_timezone: string | null;
} {
  return {
    device_captured_at: isoWithLocalOffset(now),
    device_timezone: deviceTimezone(),
  };
}

export function isoWithLocalOffset(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  );
}

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function newClientSubmissionId(now: Date = new Date()): string {
  return `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newOutboxItem(
  payload: MobileFieldSubmissionCreate,
  boreholeCode: string | null,
  now: Date = new Date(),
): OutboxItem {
  const id = newClientSubmissionId(now);
  // The payload may already carry a stable client id and capture metadata (generated
  // when the geologist tapped sync); resends must keep exactly those, so the server
  // recognizes the replay.
  const capture = deviceCaptureMetadata(now);
  return {
    id,
    boreholeId: payload.borehole_id,
    boreholeCode,
    label: outboxLabel(payload),
    queuedAt: now.toISOString(),
    payload: {
      ...payload,
      client_submission_id: payload.client_submission_id ?? id,
      device_captured_at: payload.device_captured_at ?? capture.device_captured_at,
      device_timezone: payload.device_timezone ?? capture.device_timezone,
    },
    state: "waiting",
  };
}

/** localStorage is limited to a few MB in every browser; warn well before the quota. */
export const OUTBOX_SOFT_LIMIT_BYTES = 3_500_000;

export function outboxStorageBytes(items: OutboxItem[]): number {
  return JSON.stringify(items).length;
}

export function outboxCapacityWarning(items: OutboxItem[]): string | null {
  if (outboxStorageBytes(items) < OUTBOX_SOFT_LIMIT_BYTES) return null;
  const megabytes = (outboxStorageBytes(items) / 1_048_576).toFixed(1);
  return `Device storage is filling up (${megabytes} MB of roughly 5 MB). Send or discard saved items before new captures are kept.`;
}

/** True when localStorage.setItem failed because the quota was exceeded. */
export function isQuotaExceededError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
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
