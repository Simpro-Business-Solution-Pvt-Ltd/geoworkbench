import type { Curve, CurveSampleWindow, DisplayTrack } from "../../../api/types";
import type { DepthSpan } from "../../core/depthDomain";

export type CurveWithWindowSamples = {
  config: NonNullable<DisplayTrack["curves"]>[number];
  curve: Curve;
};

export type CurveWindowQueryIdentity = {
  boreholeId: number;
  curveKey: string;
  fromDepth: number;
  toDepth: number;
  maxSamples: number | null;
};

const DEFAULT_WINDOW_PRECISION = 3;

export function shouldUseWindowedCurveSamples(track: DisplayTrack): boolean {
  return track.renderer?.sampleSource === "visible-window";
}

export function curveWindowQueryIdentity(
  boreholeId: number,
  curveKey: string,
  visibleDepthSpan: DepthSpan,
  maxSamples: number | null,
): CurveWindowQueryIdentity {
  return {
    boreholeId,
    curveKey,
    fromDepth: roundDepth(visibleDepthSpan.fromDepth),
    toDepth: roundDepth(visibleDepthSpan.toDepth),
    maxSamples,
  };
}

export function curveWindowQueryKey(identity: CurveWindowQueryIdentity) {
  return [
    "curveSamples",
    identity.boreholeId,
    identity.curveKey,
    identity.fromDepth,
    identity.toDepth,
    identity.maxSamples ?? "all",
  ] as const;
}

export function applyCurveSampleWindow(curve: Curve, window: CurveSampleWindow | null | undefined): Curve {
  if (!window || window.key !== curve.key) return curve;
  return {
    ...curve,
    curve_metadata: {
      ...(curve.curve_metadata ?? {}),
      window_samples: {
        from_depth: window.from_depth,
        to_depth: window.to_depth,
        full_sample_count: window.full_sample_count,
        window_sample_count: window.window_sample_count,
        returned_sample_count: window.returned_sample_count,
        display_mode: window.display_mode,
      },
    },
    samples: window.samples,
  };
}

export function resolveConfiguredCurves(
  curves: Curve[],
  configuredCurves: NonNullable<DisplayTrack["curves"]>,
  windowsByCurveKey: Map<string, CurveSampleWindow>,
): CurveWithWindowSamples[] {
  return configuredCurves
    .map((config) => {
      const curve = curves.find((item) => item.key === config.curveKey);
      if (!curve) return null;
      return {
        config,
        curve: applyCurveSampleWindow(curve, windowsByCurveKey.get(curve.key)),
      };
    })
    .filter((item): item is CurveWithWindowSamples => Boolean(item));
}

function roundDepth(value: number): number {
  const multiplier = 10 ** DEFAULT_WINDOW_PRECISION;
  return Math.round(value * multiplier) / multiplier;
}
