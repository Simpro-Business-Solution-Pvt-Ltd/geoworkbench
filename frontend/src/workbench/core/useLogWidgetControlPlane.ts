import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { DepthSpan } from "./depthDomain";
import {
  createLogWidgetControlPlane,
  defaultLogWidgetControlPlaneState,
  type LogWidgetControlPlane,
  type LogWidgetControlPlaneConfig,
  type LogWidgetControlPlaneState,
} from "./logWidgetControlPlane";
import type { LogViewportControllerSnapshot } from "./logViewportController";
import { clampToBounds } from "./logViewport";

type UseLogWidgetControlPlaneConfig = {
  depthDomain: DepthSpan;
  containerHeight: number;
  headerHeight: number;
  scrollElement: HTMLDivElement | null;
  resetKey: string | number;
  zoomEpsilon: number;
};

export function useLogWidgetControlPlane({
  depthDomain,
  containerHeight,
  headerHeight,
  scrollElement,
  resetKey,
  zoomEpsilon,
}: UseLogWidgetControlPlaneConfig) {
  const pendingScrollTop = useRef<number | null>(null);
  const config = useMemo<LogWidgetControlPlaneConfig>(
    () => ({ depthDomain, containerHeight, headerHeight, zoomEpsilon }),
    [containerHeight, depthDomain, headerHeight, zoomEpsilon],
  );
  const configRef = useRef(config);
  const [state, setState] = useState<LogWidgetControlPlaneState>(() =>
    defaultLogWidgetControlPlaneState(config),
  );
  const controlPlane = useMemo(
    () => createLogWidgetControlPlane(config, state),
    [config, state],
  );
  const controlPlaneRef = useRef<LogWidgetControlPlane>(controlPlane);
  const isZoomed =
    controlPlane.snapshot.viewport.pixelsPerDepth >
    controlPlane.snapshot.defaultScale + config.zoomEpsilon;

  useEffect(() => {
    controlPlaneRef.current = controlPlane;
  }, [controlPlane]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const commitSnapshot = useCallback((next: LogViewportControllerSnapshot) => {
    pendingScrollTop.current = next.viewport.scrollTop;
    setState((current) => (sameControlPlaneState(current, next.state) ? current : next.state));
  }, []);

  useLayoutEffect(() => {
    const target = pendingScrollTop.current;
    if (target === null || !scrollElement) return;
    const maxScrollTop = controlPlaneRef.current.snapshot.viewport.maxScrollTop;
    const clamped = clampToBounds(target, 0, maxScrollTop);
    if (Math.abs(scrollElement.scrollTop - clamped) > 0.5) {
      scrollElement.scrollTop = clamped;
    }
    pendingScrollTop.current = null;
  }, [controlPlane.snapshot.viewport.contentHeight, controlPlane.snapshot.viewport.maxScrollTop, scrollElement]);

  useEffect(() => {
    const next = createLogWidgetControlPlane(
      configRef.current,
      defaultLogWidgetControlPlaneState(configRef.current),
    ).resetFullDepth();
    pendingScrollTop.current = 0;
    setState((current) => (sameControlPlaneState(current, next.state) ? current : next.state));
  }, [resetKey]);

  useEffect(() => {
    if (state.zoomPinned) return;
    const next = defaultLogWidgetControlPlaneState(config);
    pendingScrollTop.current = next.scrollTop;
    setState((current) => (sameControlPlaneState(current, next) ? current : next));
  }, [config, state.zoomPinned]);

  useEffect(() => {
    const maxScrollTop = controlPlane.snapshot.viewport.maxScrollTop;
    if (state.scrollTop <= maxScrollTop) return;
    commitSnapshot(controlPlane.scrollTo(maxScrollTop));
  }, [commitSnapshot, controlPlane, state.scrollTop]);

  const zoomAtDepth = useCallback(
    (depth: number, factor: number, viewportY = controlPlaneRef.current.snapshot.viewport.visibleBodyHeight / 2) => {
      commitSnapshot(controlPlaneRef.current.zoomAtDepth(depth, factor, viewportY));
    },
    [commitSnapshot],
  );

  const zoomToDepthWindow = useCallback(
    (fromDepth: number, toDepth: number, minDepthSpan: number) => {
      commitSnapshot(controlPlaneRef.current.zoomToDepthWindow(fromDepth, toDepth, minDepthSpan));
    },
    [commitSnapshot],
  );

  const resetFullDepth = useCallback(() => {
    commitSnapshot(controlPlaneRef.current.resetFullDepth());
  }, [commitSnapshot]);

  const scrollTo = useCallback((nextScrollTop: number) => {
    setState((current) => {
      const currentPlane = createLogWidgetControlPlane(configRef.current, current);
      const next = currentPlane.scrollTo(nextScrollTop).state;
      return sameControlPlaneState(current, next) ? current : next;
    });
  }, []);

  return {
    controlPlane,
    isZoomed,
    zoomAtDepth,
    zoomToDepthWindow,
    resetFullDepth,
    scrollTo,
  };
}

function sameControlPlaneState(left: LogWidgetControlPlaneState, right: LogWidgetControlPlaneState) {
  return (
    Math.abs(left.pixelsPerDepth - right.pixelsPerDepth) < 0.0001 &&
    Math.abs(left.scrollTop - right.scrollTop) < 0.5 &&
    left.zoomPinned === right.zoomPinned
  );
}
