import { describe, expect, it } from "vitest";

import { capturePhotoMetadata, photoLabel, type PhotoQueueItem } from "./fieldPhotoQueue";

function file(name: string): File {
  return new File(["core"], name, { type: "image/jpeg" });
}

describe("field photo queue helpers", () => {
  it("reads the capture moment from a camera filename when present", () => {
    const metadata = capturePhotoMetadata(file("IMG_20261125_093012.jpg"), new Date("2026-11-25T12:00:00Z"));
    // 09:30:12 local on 25 Nov, with the local offset rather than a shifted UTC instant.
    expect(metadata.capturedAt).toMatch(/^2026-11-25T09:30:12[+-]\d{2}:\d{2}$/);
    expect(typeof metadata.capturedAtTz).toBe("string");
  });

  it("falls back to the moment the file reached the app without a camera timestamp", () => {
    const now = new Date("2026-11-25T04:05:06Z");
    const metadata = capturePhotoMetadata(file("photo.jpg"), now);
    const signed = metadata.capturedAt.slice(-6);
    const offsetMinutes =
      (signed.startsWith("+") ? 1 : -1) * (Number(signed.slice(0, 3)) * 60 + Number(signed.slice(4)));
    expect(offsetMinutes).toBe(-now.getTimezoneOffset());
    expect(metadata.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  });

  it("labels a photo by file name and borehole", () => {
    const item: Pick<PhotoQueueItem, "name" | "boreholeCode" | "boreholeId"> = {
      name: "IMG_1.jpg",
      boreholeCode: "MGCA-08",
      boreholeId: 17,
    };
    expect(photoLabel(item)).toBe("IMG_1.jpg · MGCA-08");
    expect(photoLabel({ name: "IMG_1.jpg", boreholeCode: null, boreholeId: 17 })).toBe("IMG_1.jpg · borehole 17");
    expect(photoLabel({ name: "IMG_1.jpg", boreholeCode: null, boreholeId: null })).toBe("IMG_1.jpg · no borehole");
  });
});
