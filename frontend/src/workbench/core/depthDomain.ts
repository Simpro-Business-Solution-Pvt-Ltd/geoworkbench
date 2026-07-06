import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";

export type DepthSpan = {
  fromDepth: number;
  toDepth: number;
};

export function normalizeDepthSpan(span: DepthSpan): DepthSpan {
  const fromDepth = Math.min(span.fromDepth, span.toDepth);
  const toDepth = Math.max(span.fromDepth, span.toDepth);
  return { fromDepth, toDepth };
}

export function depthSpanSize(span: DepthSpan): number {
  return Math.max(0, Math.abs(span.toDepth - span.fromDepth));
}

function pushSpan(ranges: DepthSpan[], fromDepth: number | null | undefined, toDepth: number | null | undefined) {
  if (typeof fromDepth !== "number" || typeof toDepth !== "number") return;
  const a = Math.min(fromDepth, toDepth);
  const b = Math.max(fromDepth, toDepth);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return;
  ranges.push({ fromDepth: a, toDepth: b });
}

export function inferLogWidgetDepthSpan(data: BoreholeWorkbench, tracks: DisplayTrack[] | null | undefined): DepthSpan {
  const spans: DepthSpan[] = [];

  const fallbackSpan: DepthSpan = {
    fromDepth: 0,
    toDepth: Math.max(0, Number(data.total_depth) || 0),
  };

  if (!fallbackSpan.toDepth || !Number.isFinite(fallbackSpan.toDepth)) {
    return { fromDepth: 0, toDepth: 1 };
  }

  const addFromIntervals = (intervals: Array<{ from_depth: number; to_depth: number }>) => {
    for (const interval of intervals) {
      pushSpan(spans, interval.from_depth, interval.to_depth);
    }
  };

  const hasTrack = (type: string) => (tracks ?? []).some((track) => track.visible && track.type === type);

  if (hasTrack("lithology") || hasTrack("quantitativeBar")) {
    addFromIntervals(data.lithology_intervals);
  }

  if (hasTrack("seam")) {
    addFromIntervals(data.seam_intervals);
  }

  if (hasTrack("remarks")) {
    addFromIntervals(data.lithology_intervals.filter((interval) => Boolean(interval.remark)));
  }

  if (hasTrack("images")) {
    for (const image of data.core_images) {
      pushSpan(spans, image.from_depth, image.to_depth);
    }
  }

  if (hasTrack("curve")) {
    for (const track of tracks ?? []) {
      if (track.type !== "curve" || !track.visible) continue;
      for (const curveConfig of track.curves ?? []) {
        if (!curveConfig.visible) continue;
        const curve = data.curves.find((item) => item.key === curveConfig.curveKey);
        if (!curve) continue;
        for (const sample of curve.samples) {
          pushSpan(spans, sample.depth, sample.depth);
        }
      }
    }
  }

  if (hasTrack("aiSuggestions")) {
    for (const suggestion of data.ai_suggestions ?? []) {
      const depth = suggestion.from_depth ?? suggestion.to_depth;
      if (typeof depth === "number") {
        spans.push({ fromDepth: depth, toDepth: suggestion.to_depth ?? depth });
      }
    }
  }

  if (hasTrack("depthAxis") || hasTrack("depth-axis")) {
    spans.push(fallbackSpan);
  } else if (spans.length === 0) {
    return fallbackSpan.toDepth > 0 ? fallbackSpan : { fromDepth: 0, toDepth: 1 };
  }

  let fromDepth = spans[0].fromDepth;
  let toDepth = spans[0].toDepth;

  for (const span of spans.slice(1)) {
    fromDepth = Math.min(fromDepth, span.fromDepth);
    toDepth = Math.max(toDepth, span.toDepth);
  }

  if (!Number.isFinite(fromDepth) || !Number.isFinite(toDepth) || toDepth <= fromDepth) {
    return fallbackSpan.toDepth > 0 ? fallbackSpan : { fromDepth: 0, toDepth: 1 };
  }

  return { fromDepth, toDepth };
}

export function clampDepthWindow(window: DepthSpan, bounds: DepthSpan): DepthSpan {
  const normalizedBounds = normalizeDepthSpan(bounds);
  const normalizedWindow = normalizeDepthSpan(window);
  const minDepth = normalizedBounds.fromDepth;
  const maxDepth = normalizedBounds.toDepth;
  const span = Math.max(0.001, depthSpanSize(normalizedBounds));
  const fromDepth = Math.min(maxDepth, Math.max(minDepth, normalizedWindow.fromDepth));
  const toDepth = Math.max(minDepth, Math.min(maxDepth, normalizedWindow.toDepth));

  if (toDepth - fromDepth >= span) {
    return { fromDepth: minDepth, toDepth: maxDepth };
  }

  return { fromDepth, toDepth };
}
