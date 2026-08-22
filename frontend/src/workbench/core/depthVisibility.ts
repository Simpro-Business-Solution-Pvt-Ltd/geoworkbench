import { normalizeDepthSpan, type DepthSpan } from "./depthDomain";

export type DepthIntervalLike = {
  from_depth: number;
  to_depth: number;
};

export function depthIntervalsIntersect(a: DepthSpan, b: DepthSpan): boolean {
  const left = normalizeDepthSpan(a);
  const right = normalizeDepthSpan(b);
  return left.fromDepth <= right.toDepth && left.toDepth >= right.fromDepth;
}

export function intervalIntersectsDepthSpan(interval: DepthIntervalLike, span: DepthSpan): boolean {
  return depthIntervalsIntersect(
    { fromDepth: interval.from_depth, toDepth: interval.to_depth },
    span,
  );
}

export function depthIsInsideInterval(depth: number, interval: DepthIntervalLike): boolean {
  const fromDepth = Math.min(interval.from_depth, interval.to_depth);
  const toDepth = Math.max(interval.from_depth, interval.to_depth);
  return depth >= fromDepth && depth <= toDepth;
}

export function visibleDepthIntervals<T extends DepthIntervalLike>(items: T[], span: DepthSpan): T[] {
  return items.filter((item) => intervalIntersectsDepthSpan(item, span));
}
