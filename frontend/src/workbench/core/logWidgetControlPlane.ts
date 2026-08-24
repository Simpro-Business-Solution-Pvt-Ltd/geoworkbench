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

export type LogWidgetControlPlaneConfig = LogViewportControllerConfig;
export type LogWidgetControlPlaneState = LogViewportControllerState;

export type LogWidgetPointerBounds = {
  left: number;
  top: number;
};

export type LogWidgetPointer = {
  localX: number;
  bodyY: number;
  viewportY: number;
  depth: number;
};

export type LogWidgetInvariantSnapshot = {
  virtualFromDepth: number;
  virtualToDepth: number;
  visibleFromDepth: number;
  visibleToDepth: number;
  visibleSpan: number;
  scrollTop: number;
  maxScrollTop: number;
  pixelsPerDepth: number;
  contentHeight: number;
  bodyHeight: number;
  visibleBodyHeight: number;
  headerHeight: number;
};

export type LogWidgetControlPlane = {
  snapshot: LogViewportControllerSnapshot;
  virtualDepth: DepthSpan;
  visibleDepth: DepthSpan;
  depthToBodyY: (depth: number) => number;
  bodyYToDepth: (bodyY: number) => number;
  depthToViewportY: (depth: number) => number;
  viewportYToDepth: (viewportY: number) => number;
  intervalToBodyStyle: (fromDepth: number, toDepth: number) => { top: string; height: string };
  resolvePointer: (clientX: number, clientY: number, bounds: LogWidgetPointerBounds) => LogWidgetPointer;
  scrollTo: (scrollTop: number) => LogViewportControllerSnapshot;
  zoomAtDepth: (depth: number, factor: number, viewportY?: number) => LogViewportControllerSnapshot;
  zoomToDepthWindow: (fromDepth: number, toDepth: number, minDepthSpan: number) => LogViewportControllerSnapshot;
  resetFullDepth: () => LogViewportControllerSnapshot;
  invariantSnapshot: () => LogWidgetInvariantSnapshot;
  roundTripDepth: (depth: number) => number;
};

export function defaultLogWidgetControlPlaneState(
  config: LogWidgetControlPlaneConfig,
): LogWidgetControlPlaneState {
  return defaultLogViewportControllerState(config);
}

export function createLogWidgetControlPlane(
  config: LogWidgetControlPlaneConfig,
  state: LogWidgetControlPlaneState,
): LogWidgetControlPlane {
  const snapshot = resolveLogViewportController(config, state);
  const { viewport } = snapshot;

  const bodyYToDepth = (bodyY: number) => viewport.scale.yToDepth(bodyY);
  const depthToBodyY = (depth: number) => viewport.scale.depthToY(depth);
  const depthToViewportY = (depth: number) => depthToBodyY(depth) - viewport.scrollTop;
  const viewportYToDepth = (viewportY: number) =>
    bodyYToDepth(viewport.scrollTop + clampToBounds(viewportY, 0, viewport.visibleBodyHeight));

  return {
    snapshot,
    virtualDepth: viewport.depthDomain,
    visibleDepth: viewport.visibleDepthSpan,
    depthToBodyY,
    bodyYToDepth,
    depthToViewportY,
    viewportYToDepth,
    intervalToBodyStyle: viewport.scale.intervalToStyle,
    resolvePointer: (clientX, clientY, bounds) => {
      const bodyY = clampToBounds(clientY - bounds.top, 0, viewport.scale.drawableHeight);
      return {
        localX: clientX - bounds.left,
        bodyY,
        viewportY: clampToBounds(bodyY - viewport.scrollTop, 0, viewport.visibleBodyHeight),
        depth: bodyYToDepth(bodyY),
      };
    },
    scrollTo: (scrollTop) => scrollLogViewportController(config, snapshot.state, scrollTop),
    zoomAtDepth: (depth, factor, viewportY) =>
      zoomLogViewportControllerAtDepth(config, snapshot.state, depth, factor, viewportY),
    zoomToDepthWindow: (fromDepth, toDepth, minDepthSpan) =>
      zoomLogViewportControllerToDepthWindow(config, snapshot.state, fromDepth, toDepth, minDepthSpan),
    resetFullDepth: () => resetLogViewportController(config),
    invariantSnapshot: () => ({
      virtualFromDepth: viewport.depthDomain.fromDepth,
      virtualToDepth: viewport.depthDomain.toDepth,
      visibleFromDepth: viewport.visibleDepthSpan.fromDepth,
      visibleToDepth: viewport.visibleDepthSpan.toDepth,
      visibleSpan: viewport.visibleDepthSpan.toDepth - viewport.visibleDepthSpan.fromDepth,
      scrollTop: viewport.scrollTop,
      maxScrollTop: viewport.maxScrollTop,
      pixelsPerDepth: viewport.pixelsPerDepth,
      contentHeight: viewport.contentHeight,
      bodyHeight: viewport.bodyHeight,
      visibleBodyHeight: viewport.visibleBodyHeight,
      headerHeight: config.headerHeight,
    }),
    roundTripDepth: (depth) => bodyYToDepth(depthToBodyY(depth)),
  };
}
