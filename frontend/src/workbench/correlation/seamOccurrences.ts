import type { SeamInterval } from "../../api/types";

/**
 * Bands closer than this (m) are treated as one seam. Imports that log a seam band by band
 * (coal, parting, coal ...) produce touching or near-touching records with the same name.
 */
export const SEAM_BAND_MERGE_GAP_M = 1;

export type SeamOccurrence = {
  /** Normalised seam name used for matching across boreholes. */
  key: string;
  name: string;
  /** Seam top (roof): the first band's top. */
  from_depth: number;
  /** Seam bottom (floor): the last band's bottom. */
  to_depth: number;
  bandCount: number;
};

export function seamKey(name: string | null | undefined): string {
  return (name || "Unnamed seam").trim().toUpperCase();
}

/**
 * One record per seam occurrence: same-name bands that touch (or sit within
 * SEAM_BAND_MERGE_GAP_M of each other) are merged, so a seam logged as several bands has a
 * single top and bottom. Same-name bands far apart (e.g. generic "BAND" partings at 449 m
 * and 774 m) stay separate occurrences. Sorted by top depth.
 */
export function seamOccurrences(seams: SeamInterval[]): SeamOccurrence[] {
  const byKey = new Map<string, SeamInterval[]>();
  for (const seam of seams) {
    const key = seamKey(seam.name);
    byKey.set(key, [...(byKey.get(key) ?? []), seam]);
  }
  const occurrences: SeamOccurrence[] = [];
  for (const [key, group] of byKey.entries()) {
    const sorted = [...group].sort((a, b) => a.from_depth - b.from_depth || a.to_depth - b.to_depth);
    let current: SeamOccurrence | null = null;
    for (const seam of sorted) {
      const top = Math.min(seam.from_depth, seam.to_depth);
      const bottom = Math.max(seam.from_depth, seam.to_depth);
      if (current && top - current.to_depth <= SEAM_BAND_MERGE_GAP_M) {
        current.to_depth = Math.max(current.to_depth, bottom);
        current.bandCount += 1;
        continue;
      }
      current = { key, name: (seam.name || "Unnamed seam").trim(), from_depth: top, to_depth: bottom, bandCount: 1 };
      occurrences.push(current);
    }
  }
  return occurrences.sort((a, b) => a.from_depth - b.from_depth);
}
