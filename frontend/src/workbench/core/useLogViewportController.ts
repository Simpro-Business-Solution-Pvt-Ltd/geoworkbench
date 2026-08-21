import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { DepthSpan } from "./depthDomain";
import {
  clampToBounds,
  defaultPixelsPerDepth,
  resolveLogViewport,
  zoomViewportAtDepth,
  zoomViewportToDepthSpan,
} from "./logViewport";

type UseLogViewportControllerConfig = {
  depthDomain: DepthSpan;
  containerHeight: number;
  headerHeight: number;
  scrollElement: HTMLDivElement | null;
  resetKey: string | number;
  zoomEpsilon: number;
};

export function useLogViewportController({
  depthDomain,
  containerHeight,
  headerHeight,
  scrollElement,
  resetKey,
  zoomEpsilon,
}: UseLogViewportControllerConfig) {
  const pendingScrollTop = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [pixelsPerDepth, setPixelsPerDepth] = useState(1);
  const [zoomPinned, setZoomPinned] = useState(false);
  const defaultScale = useMemo(
    () => defaultPixelsPerDepth(depthDomain, containerHeight, headerHeight),
    [containerHeight, depthDomain, headerHeight],
  );
  const viewport = useMemo(
    () =>
      resolveLogViewport({
        depthDomain,
        containerHeight,
        headerHeight,
        pixelsPerDepth,
        scrollTop,
        minPixelsPerDepth: defaultScale,
      }),
    [containerHeight, defaultScale, depthDomain, headerHeight, pixelsPerDepth, scrollTop],
  );
  const viewportRef = useRef(viewport);
  const defaultScaleRef = useRef(defaultScale);
  const isZoomed = viewport.pixelsPerDepth > defaultScale + zoomEpsilon;

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    defaultScaleRef.current = defaultScale;
  }, [defaultScale]);

  const syncScrollElement = useCallback((nextScrollTop: number, maxScrollTop = viewportRef.current.maxScrollTop) => {
    const clamped = clampToBounds(nextScrollTop, 0, maxScrollTop);
    pendingScrollTop.current = clamped;
    setScrollTop(clamped);
  }, []);

  useLayoutEffect(() => {
    const target = pendingScrollTop.current;
    if (target === null || !scrollElement) return;
    const clamped = clampToBounds(target, 0, viewport.maxScrollTop);
    scrollElement.scrollTop = clamped;
    setScrollTop(clamped);
    pendingScrollTop.current = null;
  }, [scrollElement, viewport.contentHeight, viewport.maxScrollTop]);

  useEffect(() => {
    setPixelsPerDepth(defaultScaleRef.current);
    setZoomPinned(false);
    syncScrollElement(0);
  }, [resetKey, syncScrollElement]);

  useEffect(() => {
    if (!zoomPinned) {
      setPixelsPerDepth(defaultScale);
    }
  }, [defaultScale, zoomPinned]);

  useEffect(() => {
    if (scrollTop <= viewport.maxScrollTop) return;
    syncScrollElement(viewport.maxScrollTop);
  }, [scrollTop, syncScrollElement, viewport.maxScrollTop]);

  const applyZoomAtDepth = useCallback(
    (depth: number, factor: number, viewportBodyY = viewport.visibleBodyHeight / 2) => {
      const transition = zoomViewportAtDepth(
        {
          depthDomain,
          containerHeight,
          headerHeight,
          pixelsPerDepth: viewport.pixelsPerDepth,
          scrollTop: viewport.scrollTop,
          minPixelsPerDepth: defaultScale,
        },
        depth,
        factor,
        viewportBodyY,
      );
      setPixelsPerDepth(transition.pixelsPerDepth);
      setZoomPinned(transition.pixelsPerDepth > defaultScale + zoomEpsilon);
      syncScrollElement(transition.scrollTop, transition.viewport.maxScrollTop);
    },
    [containerHeight, defaultScale, depthDomain, headerHeight, syncScrollElement, viewport, zoomEpsilon],
  );

  const zoomToDepthWindow = useCallback(
    (fromDepth: number, toDepth: number, minDepthSpan: number) => {
      const transition = zoomViewportToDepthSpan(
        {
          depthDomain,
          containerHeight,
          headerHeight,
          pixelsPerDepth: viewport.pixelsPerDepth,
          scrollTop: viewport.scrollTop,
          minPixelsPerDepth: defaultScale,
        },
        fromDepth,
        toDepth,
        minDepthSpan,
      );
      setPixelsPerDepth(transition.pixelsPerDepth);
      setZoomPinned(transition.pixelsPerDepth > defaultScale + zoomEpsilon);
      syncScrollElement(transition.scrollTop, transition.viewport.maxScrollTop);
    },
    [containerHeight, defaultScale, depthDomain, headerHeight, syncScrollElement, viewport, zoomEpsilon],
  );

  const resetToFullDepth = useCallback(() => {
    setPixelsPerDepth(defaultScale);
    setZoomPinned(false);
    syncScrollElement(0);
  }, [defaultScale, syncScrollElement]);

  return {
    viewport,
    defaultScale,
    isZoomed,
    applyZoomAtDepth,
    zoomToDepthWindow,
    resetToFullDepth,
    setScrollTop,
  };
}
