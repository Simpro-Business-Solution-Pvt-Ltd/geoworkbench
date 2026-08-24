import type { CSSProperties } from "react";

import type { DisplayTrack, LithologyInterval } from "../../../api/types";
import type { DepthScale } from "../../core/depthScale";
import type { DepthSpan } from "../../core/depthDomain";
import { visibleDepthIntervals } from "../../core/depthVisibility";

export type QuantitativeBarRenderModel = {
  interval: LithologyInterval;
  key: string;
  title: string;
  rowStyle: CSSProperties;
  barStyle: CSSProperties;
  value: number;
};

export function buildQuantitativeBarRenderModels(
  intervals: LithologyInterval[],
  track: DisplayTrack,
  scale: DepthScale,
  visibleDepthSpan: DepthSpan,
): QuantitativeBarRenderModel[] {
  return visibleDepthIntervals(intervals, visibleDepthSpan)
    .map((interval) => buildQuantitativeBarRenderModel(interval, track, scale))
    .filter((model): model is QuantitativeBarRenderModel => Boolean(model));
}

export function buildQuantitativeBarRenderModel(
  interval: LithologyInterval,
  track: DisplayTrack,
  scale: DepthScale,
): QuantitativeBarRenderModel | null {
  const value = valueForInterval(track, interval);
  if (value === null) return null;

  const min = track.min ?? 0;
  const max = track.max ?? 100;
  const span = Math.max(0.001, max - min);
  const width = Math.max(0, Math.min(100, ((value - min) / span) * 100));
  return {
    interval,
    key: `${track.id}:${interval.id}`,
    title: `${track.title}: ${value.toFixed(1)}${track.unit ?? ""}`,
    rowStyle: scale.intervalToStyle(interval.from_depth, interval.to_depth),
    barStyle: {
      width: `${width}%`,
      background: track.color ?? "#55b7aa",
    },
    value,
  };
}

export function valueForInterval(track: DisplayTrack, interval: LithologyInterval): number | null {
  if (!track.valueField) return null;
  const raw = interval[track.valueField];
  if (raw === null || raw === undefined) return null;
  return raw * (track.valueMultiplier ?? 1);
}
