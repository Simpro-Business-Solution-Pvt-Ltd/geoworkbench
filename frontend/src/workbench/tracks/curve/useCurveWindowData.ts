import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";

import { getCurveSampleWindow } from "../../../api/client";
import type { BoreholeWorkbench, CurveSampleWindow, DisplayTrack } from "../../../api/types";
import type { DepthSpan } from "../../core/depthDomain";
import {
  curveWindowQueryIdentity,
  curveWindowQueryKey,
  resolveConfiguredCurves,
  shouldUseWindowedCurveSamples,
} from "./curveWindowData";

type UseCurveWindowDataArgs = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  visibleDepthSpan: DepthSpan;
};

export function useCurveWindowData({ data, track, visibleDepthSpan }: UseCurveWindowDataArgs) {
  const configuredCurves = useMemo(
    () => track.curves?.filter((curve) => curve.visible) ?? [],
    [track.curves],
  );
  const useWindowedSamples = shouldUseWindowedCurveSamples(track);
  const maxSamples = numericRendererSetting(track, "maxWindowSamples", null);
  const identities = useMemo(
    () =>
      configuredCurves.map((curve) =>
        curveWindowQueryIdentity(data.id, curve.curveKey, visibleDepthSpan, maxSamples),
      ),
    [configuredCurves, data.id, maxSamples, visibleDepthSpan],
  );
  const queries = useQueries({
    queries: identities.map((identity) => ({
      queryKey: curveWindowQueryKey(identity),
      queryFn: () =>
        getCurveSampleWindow(
          identity.boreholeId,
          identity.curveKey,
          identity.fromDepth,
          identity.toDepth,
          identity.maxSamples,
        ),
      enabled:
        useWindowedSamples &&
        data.curves.some((curve) => curve.key === identity.curveKey),
      staleTime: 5_000,
    })),
  });
  const windowsByCurveKey = useMemo(() => {
    const map = new Map<string, CurveSampleWindow>();
    for (const query of queries) {
      if (query.data) {
        map.set(query.data.key, query.data);
      }
    }
    return map;
  }, [queries]);

  return {
    configuredCurves,
    curves: resolveConfiguredCurves(data.curves, configuredCurves, windowsByCurveKey),
    isFetching: queries.some((query) => query.isFetching),
    useWindowedSamples,
  };
}

function numericRendererSetting(track: DisplayTrack, key: string, fallback: number | null): number | null {
  const value = track.renderer?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
