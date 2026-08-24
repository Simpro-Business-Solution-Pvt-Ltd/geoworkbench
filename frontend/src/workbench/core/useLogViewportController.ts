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
  const configRef = useRef(config);
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

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const commitSnapshot = useCallback((next: LogViewportControllerSnapshot) => {
    pendingScrollTop.current = next.viewport.scrollTop;
    setState((current) => (sameControllerState(current, next.state) ? current : next.state));
  }, []);

  useLayoutEffect(() => {
    const target = pendingScrollTop.current;
    if (target === null || !scrollElement) return;
    const clamped = clampToBounds(target, 0, viewport.maxScrollTop);
    if (Math.abs(scrollElement.scrollTop - clamped) > 0.5) {
      scrollElement.scrollTop = clamped;
    }
    pendingScrollTop.current = null;
  }, [scrollElement, viewport.contentHeight, viewport.maxScrollTop]);

  useEffect(() => {
    const next = resetLogViewportController(configRef.current);
    pendingScrollTop.current = 0;
    setState((current) => (sameControllerState(current, next.state) ? current : next.state));
  }, [resetKey]);

  useEffect(() => {
    if (!state.zoomPinned) {
      const next = defaultLogViewportControllerState(config);
      pendingScrollTop.current = next.scrollTop;
      setState((current) => (sameControllerState(current, next) ? current : next));
    }
  }, [config, defaultScale, state.zoomPinned]);

  useEffect(() => {
    if (state.scrollTop <= viewport.maxScrollTop) return;
    commitSnapshot(scrollLogViewportController(config, state, viewport.maxScrollTop));
  }, [commitSnapshot, config, state, viewport.maxScrollTop]);

  const applyZoomAtDepth = useCallback(
    (depth: number, factor: number, viewportBodyY = snapshotRef.current.viewport.visibleBodyHeight / 2) => {
      const next = zoomLogViewportControllerAtDepth(
        config,
        snapshotRef.current.state,
        depth,
        factor,
        viewportBodyY,
      );
      commitSnapshot(next);
    },
    [commitSnapshot, config],
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
      commitSnapshot(next);
    },
    [commitSnapshot, config],
  );

  const resetToFullDepth = useCallback(() => {
    const next = resetLogViewportController(config);
    commitSnapshot(next);
  }, [commitSnapshot, config]);

  const setScrollTop = useCallback(
    (nextScrollTop: number) => {
      setState((current) => {
        const next = scrollLogViewportController(config, current, nextScrollTop).state;
        return sameControllerState(current, next) ? current : next;
      });
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

function sameControllerState(left: LogViewportControllerState, right: LogViewportControllerState) {
  return (
    Math.abs(left.pixelsPerDepth - right.pixelsPerDepth) < 0.0001 &&
    Math.abs(left.scrollTop - right.scrollTop) < 0.5 &&
    left.zoomPinned === right.zoomPinned
  );
}
