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
    const rightByName = new Map(right.seam_intervals.map((seam) => [seamKey(seam), seam]));
    for (const leftSeam of left.seam_intervals) {
      const key = seamKey(leftSeam);
      const rightSeam = rightByName.get(key);
      if (!rightSeam) continue;
      const leftMid = seamMidDepth(leftSeam);
      const rightMid = seamMidDepth(rightSeam);
      const offset = Math.abs(leftMid - rightMid);
      lines.push({
        id: `${left.id}:${right.id}:${key}`,
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
  return lines;
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
