import type { DisplayTrack } from "../../../api/types";

export function rendererNumber(track: DisplayTrack, key: string) {
  const value = track.renderer?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function optionalNumber(value: string) {
  return value ? Number(value) : undefined;
}
