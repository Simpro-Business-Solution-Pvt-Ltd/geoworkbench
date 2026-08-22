import type { Curve, DisplayTrack } from "../../../api/types";
import { samplesForVisibleCurve } from "../../core/curveMath";
import type { DepthScale } from "../../core/depthScale";
import { createValueScale } from "../../core/valueScale";

export type CurveDisplayConfig = NonNullable<DisplayTrack["curves"]>[number];

export type CurveRenderInput = {
  config: CurveDisplayConfig;
  curve: Curve;
};

export type CurveRenderPoint = {
  depth: number;
  value: number;
  xPercent: number;
  yPercent: number;
};

export type CurveRenderModel = {
  curveKey: string;
  color: string;
  lineStyle: string | undefined;
  points: CurveRenderPoint[];
  polylinePoints: string;
};

export function buildCurveRenderModels(
  curves: CurveRenderInput[],
  scale: DepthScale,
  options: { minYPixelSpacing?: number } = {},
): CurveRenderModel[] {
  return curves.map(({ config, curve }) => buildCurveRenderModel(config, curve, scale, options));
}

export function buildCurveRenderModel(
  config: CurveDisplayConfig,
  curve: Curve,
  scale: DepthScale,
  options: { minYPixelSpacing?: number } = {},
): CurveRenderModel {
  const valueScale = createValueScale({
    min: config.scale.min,
    max: config.scale.max,
  });
  const samples = samplesForVisibleCurve(curve.samples, scale.fromDepth, scale.toDepth);
  const points = decimateCurvePoints(
    samples.map((sample) => ({
      depth: sample.depth,
      value: sample.value,
      xPercent: valueScale.toPercent(sample.value),
      yPercent: scale.depthToContentPercent(sample.depth),
    })),
    scale,
    options.minYPixelSpacing ?? 1.5,
  );

  return {
    curveKey: curve.key,
    color: config.color,
    lineStyle: config.lineStyle,
    points,
    polylinePoints: points.map((point) => `${formatPoint(point.xPercent)},${formatPoint(point.yPercent)}`).join(" "),
  };
}

export function strokeDasharray(lineStyle: string | undefined) {
  if (lineStyle === "dashed") return "4 3";
  if (lineStyle === "dotted") return "1 3";
  return undefined;
}

function decimateCurvePoints(points: CurveRenderPoint[], scale: DepthScale, minYPixelSpacing: number) {
  if (points.length <= 2) return points;
  const next: CurveRenderPoint[] = [points[0]];
  let lastKept = points[0];
  for (const point of points.slice(1, -1)) {
    const pixelDelta = Math.abs(scale.depthToContentY(point.depth) - scale.depthToContentY(lastKept.depth));
    if (pixelDelta >= minYPixelSpacing || Math.abs(point.xPercent - lastKept.xPercent) >= 0.75) {
      next.push(point);
      lastKept = point;
    }
  }
  next.push(points[points.length - 1]);
  return next;
}

function formatPoint(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");
}
