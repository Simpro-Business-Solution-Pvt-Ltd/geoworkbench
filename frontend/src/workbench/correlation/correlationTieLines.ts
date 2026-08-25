import type { BoreholeWorkbench, SeamInterval } from "../../api/types";
import { metadataFor } from "./correlationMetadata";
import type { CorrelationAlignMode } from "./correlationInsights";

export type CorrelationTieLine = {
  id: string;
  seamName: string;
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
    const leftByName = groupSeamsByKey(left.seam_intervals);
    const rightByName = groupSeamsByKey(right.seam_intervals);
    for (const [key, leftSeams] of leftByName.entries()) {
      const rightSeams = rightByName.get(key);
      if (!rightSeams?.length) continue;
      const pairCount = Math.min(leftSeams.length, rightSeams.length);
      for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
        const leftSeam = leftSeams[pairIndex];
        const rightSeam = rightSeams[pairIndex];
        const leftMid = seamMidDepth(leftSeam);
        const rightMid = seamMidDepth(rightSeam);
        const offset = Math.abs(leftMid - rightMid);
        lines.push({
          id: `${left.id}:${right.id}:${key}:${pairIndex}`,
          seamName: key,
          fromColumn: index,
          toColumn: index + 1,
          fromY: depthY(leftMid, left, domain, alignMode),
          toY: depthY(rightMid, right, domain, alignMode),
          status: offset >= 10 ? "review" : "strong",
          offset,
        });
      }
    }
  }
  return lines;
}

function groupSeamsByKey(seams: SeamInterval[]): Map<string, SeamInterval[]> {
  const groups = new Map<string, SeamInterval[]>();
  for (const seam of seams) {
    const key = seamKey(seam);
    groups.set(key, [...(groups.get(key) ?? []), seam]);
  }
  for (const items of groups.values()) {
    items.sort((a, b) => seamMidDepth(a) - seamMidDepth(b));
  }
  return groups;
}

function seamKey(seam: SeamInterval): string {
  return (seam.name || "UNNAMED").trim().toUpperCase();
}

function seamMidDepth(seam: SeamInterval): number {
  return (seam.from_depth + seam.to_depth) / 2;
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
