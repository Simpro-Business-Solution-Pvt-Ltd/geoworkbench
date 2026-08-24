import type { DisplayTrack } from "../../api/types";

export function numericRendererSetting(
  track: Pick<DisplayTrack, "renderer">,
  key: string,
  fallback: number,
): number;
export function numericRendererSetting(
  track: Pick<DisplayTrack, "renderer">,
  key: string,
  fallback: number | null,
): number | null;
export function numericRendererSetting(
  track: Pick<DisplayTrack, "renderer">,
  key: string,
  fallback: number | null,
): number | null {
  const value = track.renderer?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function stringRendererSetting<T extends string>(
  track: Pick<DisplayTrack, "renderer">,
  key: string,
  allowedValues: readonly T[],
  fallback: T,
): T {
  const value = track.renderer?.[key];
  return typeof value === "string" && allowedValues.includes(value as T)
    ? (value as T)
    : fallback;
}

export function booleanRendererSetting(
  track: Pick<DisplayTrack, "renderer">,
  key: string,
  fallback: boolean,
): boolean {
  const value = track.renderer?.[key];
  return typeof value === "boolean" ? value : fallback;
}
