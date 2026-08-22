import type { Curve, CurveSample } from "../../api/types";

export type NearestCurveSample = {
  curve: Curve;
  sample: CurveSample;
  distance: number;
};

export function nearestSample(curve: Curve, depth: number): NearestCurveSample | null {
  if (curve.samples.length === 0) return null;
  let best = curve.samples[0];
  let distance = Math.abs(best.depth - depth);
  for (const sample of curve.samples) {
    const nextDistance = Math.abs(sample.depth - depth);
    if (nextDistance < distance) {
      best = sample;
      distance = nextDistance;
    }
  }
  return { curve, sample: best, distance };
}

export function normalizedX(value: number, min: number, max: number): number {
  if (max === min) return 50;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function samplesForVisibleCurve(
  samples: CurveSample[],
  fromDepth: number,
  toDepth: number,
): CurveSample[] {
  const sorted = [...samples].sort((a, b) => a.depth - b.depth);
  const from = Math.min(fromDepth, toDepth);
  const to = Math.max(fromDepth, toDepth);
  const visible = sorted.filter((sample) => sample.depth >= from && sample.depth <= to);
  const before = [...sorted].reverse().find((sample) => sample.depth < from);
  const after = sorted.find((sample) => sample.depth > to);
  const fromEdge = edgeSampleAtDepth(sorted, from);
  const toEdge = edgeSampleAtDepth(sorted, to);
  return dedupeSamplesByDepth([before, fromEdge, ...visible, toEdge, after]);
}

function edgeSampleAtDepth(sorted: CurveSample[], depth: number): CurveSample | null {
  const exact = sorted.find((sample) => sample.depth === depth);
  if (exact) return exact;
  const before = [...sorted].reverse().find((sample) => sample.depth < depth);
  const after = sorted.find((sample) => sample.depth > depth);
  if (!before || !after) return null;
  const fraction = (depth - before.depth) / Math.max(0.001, after.depth - before.depth);
  return {
    depth,
    value: before.value + (after.value - before.value) * fraction,
  };
}

function dedupeSamplesByDepth(samples: Array<CurveSample | null | undefined>): CurveSample[] {
  const byDepth = new Map<number, CurveSample>();
  for (const sample of samples) {
    if (!sample) continue;
    byDepth.set(sample.depth, sample);
  }
  return [...byDepth.values()].sort((a, b) => a.depth - b.depth);
}
