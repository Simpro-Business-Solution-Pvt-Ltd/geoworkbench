// Device-side queue for field photos. A captured photo is persisted in IndexedDB
// (blobs outlive localStorage, so multi-megapixel images survive too), so closing or
// reloading the app no longer loses it. A photo leaves the queue only after the
// server confirms the upload.

import { isoWithLocalOffset } from "./fieldOutbox";

export const FIELD_PHOTO_DB_NAME = "geoworkbench.field";
export const FIELD_PHOTO_STORE = "photo-queue.v1";

export type PhotoQueueItem = {
  id: string;
  boreholeId: number | null;
  boreholeCode: string | null;
  name: string;
  fileType: string;
  /** Device capture moment, wall clock with local offset. */
  capturedAt: string;
  capturedAtTz: string | null;
  queuedAt: string;
  state: "waiting" | "rejected";
  lastError?: string;
  file: Blob;
};

export function photoLabel(item: Pick<PhotoQueueItem, "name" | "boreholeCode" | "boreholeId">): string {
  const borehole = item.boreholeCode ?? (item.boreholeId ? `borehole ${item.boreholeId}` : "no borehole");
  return `${item.name} · ${borehole}`;
}

export function deviceTimezoneSafe(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function capturePhotoMetadata(file: File, now: Date = new Date()): {
  capturedAt: string;
  capturedAtTz: string | null;
} {
  // The camera timestamp, if the device embeds one in the filename (common on Android
  // "IMG_20261125_093012.jpg"), is the most reliable capture moment; otherwise the
  // moment the file reached the app.
  const captured = parseFileNameTimestamp(file.name) ?? now;
  return { capturedAt: isoWithLocalOffset(captured), capturedAtTz: deviceTimezoneSafe() };
}

function parseFileNameTimestamp(name: string): Date | null {
  const match = name.match(/(\d{4})(\d{2})(\d{2})[_-]?(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const candidate = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6]),
  );
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FIELD_PHOTO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(FIELD_PHOTO_STORE)) {
        database.createObjectStore(FIELD_PHOTO_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open the photo queue storage"));
  });
}

function withStore(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(FIELD_PHOTO_STORE, mode);
        const request = action(transaction.objectStore(FIELD_PHOTO_STORE));
        request.onsuccess = () => {
          resolve(request.result);
          database.close();
        };
        request.onerror = () => {
          reject(request.error ?? new Error("Photo queue storage failed"));
          database.close();
        };
      }),
  );
}

export async function queuePhoto(input: {
  boreholeId: number | null;
  boreholeCode: string | null;
  file: File;
  now?: Date;
}): Promise<PhotoQueueItem> {
  const now = input.now ?? new Date();
  const metadata = capturePhotoMetadata(input.file, now);
  const item: PhotoQueueItem = {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    boreholeId: input.boreholeId,
    boreholeCode: input.boreholeCode,
    name: input.file.name,
    fileType: "corebox_image",
    capturedAt: metadata.capturedAt,
    capturedAtTz: metadata.capturedAtTz,
    queuedAt: now.toISOString(),
    state: "waiting",
    file: input.file,
  };
  await withStore("readwrite", (store) => store.put(item));
  return item;
}

export async function listPhotoQueue(): Promise<PhotoQueueItem[]> {
  const items = (await withStore("readonly", (store) => store.getAll())) as PhotoQueueItem[];
  return items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
}

export async function removePhotoItem(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function setPhotoItemState(id: string, state: PhotoQueueItem["state"], lastError?: string): Promise<void> {
  const existing = (await withStore("readonly", (store) => store.get(id))) as PhotoQueueItem | undefined;
  if (!existing) return;
  const updated: PhotoQueueItem = { ...existing, state, lastError };
  await withStore("readwrite", (store) => store.put(updated));
}
