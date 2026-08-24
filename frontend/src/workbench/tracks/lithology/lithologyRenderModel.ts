import type { CSSProperties } from "react";

import type { LithologyInterval } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { DepthSpan } from "../../core/depthDomain";
import { visibleDepthIntervals } from "../../core/depthVisibility";
import { lithologyPattern } from "../../core/lithologyPatterns";
import { isCorrectedInterval } from "../../display/runtime/correctionDisplay";

export type LithologyRenderModel = {
  interval: LithologyInterval;
  key: string;
  className: string;
  style: CSSProperties;
  title: string;
};

export function buildLithologyRenderModels(
  intervals: LithologyInterval[],
  scale: DepthScale,
  visibleDepthSpan: DepthSpan,
): LithologyRenderModel[] {
  return visibleDepthIntervals(intervals, visibleDepthSpan).map((interval) =>
    buildLithologyRenderModel(interval, scale),
  );
}

export function buildLithologyRenderModel(
  interval: LithologyInterval,
  scale: DepthScale,
): LithologyRenderModel {
  const pattern = lithologyPattern(interval.lithology_code);
  return {
    interval,
    key: interval.id,
    className: [
      "lithology-block",
      "lithology-pattern",
      pattern.className,
      isCorrectedInterval(interval) ? "corrected-interval" : "",
    ]
      .filter(Boolean)
      .join(" "),
    style: {
      ...scale.intervalToStyle(interval.from_depth, interval.to_depth),
      backgroundColor: interval.display_color ?? pattern.color,
    },
    title: `${formatDepth(interval.from_depth)}-${formatDepth(interval.to_depth)}m ${interval.lithology_code ?? ""}`.trim(),
  };
}

function formatDepth(depth: number) {
  return Number.isInteger(depth) ? String(depth) : depth.toFixed(2).replace(/\.?0+$/, "");
}
