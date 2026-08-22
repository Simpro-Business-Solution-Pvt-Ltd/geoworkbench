import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { DepthSpan } from "./depthDomain";
import {
  defaultLogViewportControllerState,
  resetLogViewportController,
  resolveLogViewportController,
  scrollLogViewportController,
  zoomLogViewportControllerAtDepth,
  zoomLogViewportControllerToDepthWindow,
  type LogViewportControllerConfig,
  type LogViewportControllerSnapshot,
  type LogViewportControllerState,
} from "./logViewportController";
import { clampToBounds } from "./logViewport";

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
  const config = useMemo<LogViewportControllerConfig>(
    () => ({ depthDomain, containerHeight, headerHeight, zoomEpsilon }),
    [containerHeight, depthDomain, headerHeight, zoomEpsilon],
  );
  const [state, setState] = useState<LogViewportControllerState>(() =>
    defaultLogViewportControllerState(config),
  );
  const snapshot = useMemo(
    () => resolveLogViewportController(config, state),
    [config, state],
  );
  const snapshotRef = useRef<LogViewportControllerSnapshot>(snapshot);
  const { viewport, defaultScale, isZoomed } = snapshot;

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const syncScrollElement = useCallback(
    (nextScrollTop: number, maxScrollTop = snapshotRef.current.viewport.maxScrollTop) => {
      const clamped = clampToBounds(nextScrollTop, 0, maxScrollTop);
      pendingScrollTop.current = clamped;
      setState((current) => scrollLogViewportController(config, current, clamped).state);
    },
    [config],
  );

  useLayoutEffect(() => {
    const target = pendingScrollTop.current;
    if (target === null || !scrollElement) return;
    const clamped = clampToBounds(target, 0, viewport.maxScrollTop);
    scrollElement.scrollTop = clamped;
    setState((current) => scrollLogViewportController(config, current, clamped).state);
    pendingScrollTop.current = null;
  }, [config, scrollElement, viewport.contentHeight, viewport.maxScrollTop]);

  useEffect(() => {
    const next = resetLogViewportController(config);
    pendingScrollTop.current = 0;
    setState(next.state);
  }, [config, resetKey]);

  useEffect(() => {
    if (!state.zoomPinned) {
      setState(defaultLogViewportControllerState(config));
    }
  }, [config, defaultScale, state.zoomPinned]);

  useEffect(() => {
    if (state.scrollTop <= viewport.maxScrollTop) return;
    syncScrollElement(viewport.maxScrollTop);
  }, [state.scrollTop, syncScrollElement, viewport.maxScrollTop]);

  const applyZoomAtDepth = useCallback(
    (depth: number, factor: number, viewportBodyY = snapshotRef.current.viewport.visibleBodyHeight / 2) => {
      const next = zoomLogViewportControllerAtDepth(
        config,
        snapshotRef.current.state,
        depth,
        factor,
        viewportBodyY,
      );
      setState(next.state);
      syncScrollElement(next.viewport.scrollTop, next.viewport.maxScrollTop);
    },
    [config, syncScrollElement],
  );

  const zoomToDepthWindow = useCallback(
    (fromDepth: number, toDepth: number, minDepthSpan: number) => {
      const next = zoomLogViewportControllerToDepthWindow(
        config,
        snapshotRef.current.state,
        fromDepth,
        toDepth,
        minDepthSpan,
      );
      setState(next.state);
      syncScrollElement(next.viewport.scrollTop, next.viewport.maxScrollTop);
    },
    [config, syncScrollElement],
  );

  const resetToFullDepth = useCallback(() => {
    const next = resetLogViewportController(config);
    setState(next.state);
    syncScrollElement(0, next.viewport.maxScrollTop);
  }, [config, syncScrollElement]);

  const setScrollTop = useCallback(
    (nextScrollTop: number) => {
      setState((current) => scrollLogViewportController(config, current, nextScrollTop).state);
    },
    [config],
  );

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
