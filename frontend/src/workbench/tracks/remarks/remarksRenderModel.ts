import type { BoreholeWorkbench } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { DepthSpan } from "../../core/depthDomain";
import { intervalIntersectsDepthSpan } from "../../core/depthVisibility";

export type RemarkItem = {
  depth: number;
  text: string;
  sourceRow: number | null;
};

export type RemarkGroupRenderModel = {
  key: string;
  depth: number;
  y: number;
  count: number;
  text: string;
  label: string;
  showLabel: boolean;
  remarks: RemarkItem[];
};

export function buildRemarkGroupRenderModels(
  data: BoreholeWorkbench,
  scale: DepthScale,
  visibleDepthSpan: DepthSpan,
  options: { bucketPixels: number; labelMaxVisibleSpanM?: number },
): RemarkGroupRenderModel[] {
  const showLabelsForSpan = scale.visibleSpan <= (options.labelMaxVisibleSpanM ?? 120);
  const remarks = data.lithology_intervals
    .filter((item) => item.remark)
    .filter((item) => intervalIntersectsDepthSpan(item, visibleDepthSpan))
    .map((item) => ({
      depth: item.from_depth,
      text: item.remark ?? "",
      sourceRow: item.source_row,
    }))
    .sort((a, b) => a.depth - b.depth);

  const groups: RemarkGroupRenderModel[] = [];
  for (const remark of remarks) {
    const y = scale.depthToY(remark.depth);
    const last = groups.at(-1);
    if (last && Math.abs(last.y - y) <= options.bucketPixels) {
      last.count += 1;
      last.text = `${last.text}; ${remark.text}`;
      last.remarks.push(remark);
      last.depth = Math.min(last.depth, remark.depth);
      last.y = Math.min(last.y, y);
      last.key = remarkGroupKey(last);
      last.label = remarkGroupLabel(last);
      last.showLabel = showLabelsForSpan;
    } else {
      const group = {
        depth: remark.depth,
        y,
        count: 1,
        text: remark.text,
        remarks: [remark],
      };
      groups.push({
        ...group,
        key: remarkGroupKey(group),
        label: remarkGroupLabel(group),
        showLabel: showLabelsForSpan,
      });
    }
  }

  return groups;
}

export function findRemarkGroupAtY(
  groups: RemarkGroupRenderModel[],
  y: number,
  hitHeightPx: number,
): RemarkGroupRenderModel | null {
  return groups.find((item) => y >= item.y && y <= item.y + hitHeightPx) ?? null;
}

function remarkGroupKey(group: { depth: number; count: number }) {
  return `${group.depth}:${group.count}`;
}

function remarkGroupLabel(group: { depth: number; count: number; text: string }) {
  return group.count > 1 ? `${group.depth.toFixed(1)}m group` : group.text;
}
