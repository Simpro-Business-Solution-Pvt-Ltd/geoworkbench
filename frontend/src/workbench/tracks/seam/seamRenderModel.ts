import type { CSSProperties } from "react";

import type { SeamInterval } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { DepthSpan } from "../../core/depthDomain";
import { visibleDepthIntervals } from "../../core/depthVisibility";

export type SeamRenderModel = {
  seam: SeamInterval;
  key: string;
  title: string;
  style: CSSProperties;
  pixelHeight: number;
  showLabel: boolean;
};

export function buildSeamRenderModels(
  seams: SeamInterval[],
  scale: DepthScale,
  visibleDepthSpan: DepthSpan,
  options: { labelMinHeightPx: number },
): SeamRenderModel[] {
  return visibleDepthIntervals(seams, visibleDepthSpan).map((seam) =>
    buildSeamRenderModel(seam, scale, options),
  );
}

export function buildSeamRenderModel(
  seam: SeamInterval,
  scale: DepthScale,
  options: { labelMinHeightPx: number },
): SeamRenderModel {
  const pixelHeight = Math.abs(scale.depthToY(seam.to_depth) - scale.depthToY(seam.from_depth));
  return {
    seam,
    key: seam.id,
    title: `${seam.name}: ${formatDepth(seam.from_depth)}-${formatDepth(seam.to_depth)}m`,
    style: {
      ...scale.intervalToStyle(seam.from_depth, seam.to_depth),
      minHeight: "4px",
    },
    pixelHeight,
    showLabel: pixelHeight >= options.labelMinHeightPx,
  };
}

function formatDepth(depth: number) {
  return Number.isInteger(depth) ? String(depth) : depth.toFixed(2).replace(/\.?0+$/, "");
}
