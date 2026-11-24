import type { BoreholeWorkbench } from "../../api/types";
import { metadataFor } from "./correlationMetadata";
import { seamOccurrences, type SeamOccurrence } from "./seamOccurrences";
import type { CorrelationAlignMode } from "./correlationInsights";

export type CorrelationTieLine = {
  id: string;
  seamName: string;
  marker: "top" | "bottom";
  fromColumn: number;
  toColumn: number;
  fromY: number;
  toY: number;
  status: "strong" | "review";
  offset: number;
};

export function buildSeamTieLines(
  items: BoreholeWorkbench[],
  domain: { min: number; max: number },
  alignMode: CorrelationAlignMode,
): CorrelationTieLine[] {
  const lines: CorrelationTieLine[] = [];
  for (let index = 0; index < items.length - 1; index += 1) {
    const left = items[index];
    const right = items[index + 1];
    // Whole seams (bands merged), so a seam logged band by band ties top-to-top and
    // bottom-to-bottom instead of first band to first band.
    const leftByName = groupByKey(seamOccurrences(left.seam_intervals));
    const rightByName = groupByKey(seamOccurrences(right.seam_intervals));
    for (const [key, leftSeams] of leftByName.entries()) {
      const rightSeams = rightByName.get(key);
      if (!rightSeams?.length) continue;
      const pairCount = Math.min(leftSeams.length, rightSeams.length);
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const leftSeam = leftSeams[pairIndex];
        const rightSeam = rightSeams[pairIndex];
        const markers = [
          { marker: "top" as const, leftDepth: leftSeam.from_depth, rightDepth: rightSeam.from_depth },
          { marker: "bottom" as const, leftDepth: leftSeam.to_depth, rightDepth: rightSeam.to_depth },
        ];
        for (const marker of markers) {
          const offset = Math.abs(marker.leftDepth - marker.rightDepth);
          lines.push({
          id: `${left.id}:${right.id}:${key}:${pairIndex}:${marker.marker}`,
          seamName: key,
          marker: marker.marker,
          fromColumn: index,
          toColumn: index + 1,
          fromY: depthY(marker.leftDepth, left, domain, alignMode),
          toY: depthY(marker.rightDepth, right, domain, alignMode),
          status: offset >= 10 ? "review" : "strong",
          offset,
          });
        }
      }
    }
  }
  return lines;
}

/** Occurrences come sorted by top depth, so repeated names pair in depth order. */
function groupByKey(occurrences: SeamOccurrence[]): Map<string, SeamOccurrence[]> {
  const groups = new Map<string, SeamOccurrence[]>();
  for (const occurrence of occurrences) {
    groups.set(occurrence.key, [...(groups.get(occurrence.key) ?? []), occurrence]);
  }
  return groups;
}

function depthY(
  depth: number,
  data: BoreholeWorkbench,
  domain: { min: number; max: number },
  alignMode: CorrelationAlignMode,
): number {
  const meta = metadataFor(data);
  const value = alignMode === "rl" ? meta.rl - depth : depth;
  const percent = ((value - domain.min) / Math.max(1, domain.max - domain.min)) * 100;
  return alignMode === "rl" ? 100 - percent : percent;
}
