import type { TrackObject } from "../../core/trackObject";
import { nearestSample } from "../../core/curveMath";
import type { DepthScale } from "../../core/depthScale";
import { createValueScale } from "../../core/valueScale";
import type { CurveRenderInput } from "./curveRenderModel";

export type CurveSampleTrackObject = Extract<TrackObject, { kind: "curve-sample" }>;

export function buildCurveSampleHit(
  curves: CurveRenderInput[],
  scale: DepthScale,
  depth: number,
): CurveSampleTrackObject | null {
  const hits = curves
    .map(({ config, curve }) => {
      const nearest = nearestSample(curve, depth);
      if (!nearest) return null;
      const valueScale = createValueScale({
        min: config.scale.min,
        max: config.scale.max,
      });
      return {
        ...nearest,
        screenXPercent: valueScale.toPercent(nearest.sample.value),
        screenYPercent: scale.depthToContentPercent(nearest.sample.depth),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => a.distance - b.distance);

  const best = hits[0];
  if (!best) return null;

  return {
    kind: "curve-sample",
    id: `${best.curve.key}:${best.sample.depth}`,
    depth: best.sample.depth,
    curve: best.curve,
    sample: best.sample,
    distance: best.distance,
    screenXPercent: best.screenXPercent,
    screenYPercent: best.screenYPercent,
    relatedSamples: hits.map((hit) => ({
      curve: hit.curve,
      sample: hit.sample,
      distance: hit.distance,
      screenXPercent: hit.screenXPercent,
    })),
  };
}

export function curveHitBelongsToTrack(
  object: TrackObject | null | undefined,
  curves: CurveRenderInput[],
): object is CurveSampleTrackObject {
  return object?.kind === "curve-sample" && curves.some(({ curve }) => curve.key === object.curve.key);
}
