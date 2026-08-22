import type { DepthSpan } from "./depthDomain";
import {
  clampToBounds,
  defaultPixelsPerDepth,
  resolveLogViewport,
  zoomViewportAtDepth,
  zoomViewportToDepthSpan,
  type LogViewportState,
} from "./logViewport";

export type LogViewportControllerConfig = {
  depthDomain: DepthSpan;
  containerHeight: number;
  headerHeight: number;
  zoomEpsilon: number;
};

export type LogViewportControllerState = {
  pixelsPerDepth: number;
  scrollTop: number;
  zoomPinned: boolean;
};

export type LogViewportControllerSnapshot = {
  viewport: LogViewportState;
  defaultScale: number;
  isZoomed: boolean;
  state: LogViewportControllerState;
};

export function defaultLogViewportControllerState(
  config: LogViewportControllerConfig,
): LogViewportControllerState {
  return {
    pixelsPerDepth: defaultPixelsPerDepth(
      config.depthDomain,
      config.containerHeight,
      config.headerHeight,
    ),
    scrollTop: 0,
    zoomPinned: false,
  };
}

export function resolveLogViewportController(
  config: LogViewportControllerConfig,
  state: LogViewportControllerState,
): LogViewportControllerSnapshot {
  const defaultScale = defaultPixelsPerDepth(
    config.depthDomain,
    config.containerHeight,
    config.headerHeight,
  );
  const viewport = resolveLogViewport({
    depthDomain: config.depthDomain,
    containerHeight: config.containerHeight,
    headerHeight: config.headerHeight,
    pixelsPerDepth: state.pixelsPerDepth,
    scrollTop: state.scrollTop,
    minPixelsPerDepth: defaultScale,
  });
  const isZoomed = viewport.pixelsPerDepth > defaultScale + config.zoomEpsilon;
  return {
    viewport,
    defaultScale,
    isZoomed,
    state: {
      pixelsPerDepth: viewport.pixelsPerDepth,
      scrollTop: viewport.scrollTop,
      zoomPinned: state.zoomPinned && isZoomed,
    },
  };
}

export function scrollLogViewportController(
  config: LogViewportControllerConfig,
  state: LogViewportControllerState,
  scrollTop: number,
): LogViewportControllerSnapshot {
  const current = resolveLogViewportController(config, state);
  return resolveLogViewportController(config, {
    ...current.state,
    scrollTop: clampToBounds(scrollTop, 0, current.viewport.maxScrollTop),
  });
}

export function resetLogViewportController(
  config: LogViewportControllerConfig,
): LogViewportControllerSnapshot {
  return resolveLogViewportController(config, defaultLogViewportControllerState(config));
}

export function zoomLogViewportControllerAtDepth(
  config: LogViewportControllerConfig,
  state: LogViewportControllerState,
  depth: number,
  factor: number,
  viewportBodyY?: number,
): LogViewportControllerSnapshot {
  const current = resolveLogViewportController(config, state);
  const transition = zoomViewportAtDepth(
    {
      depthDomain: config.depthDomain,
      containerHeight: config.containerHeight,
      headerHeight: config.headerHeight,
      pixelsPerDepth: current.viewport.pixelsPerDepth,
      scrollTop: current.viewport.scrollTop,
      minPixelsPerDepth: current.defaultScale,
    },
    depth,
    factor,
    viewportBodyY,
  );
  return resolveLogViewportController(config, {
    pixelsPerDepth: transition.pixelsPerDepth,
    scrollTop: transition.scrollTop,
    zoomPinned: transition.pixelsPerDepth > current.defaultScale + config.zoomEpsilon,
  });
}

export function zoomLogViewportControllerToDepthWindow(
  config: LogViewportControllerConfig,
  state: LogViewportControllerState,
  fromDepth: number,
  toDepth: number,
  minDepthSpan: number,
): LogViewportControllerSnapshot {
  const current = resolveLogViewportController(config, state);
  const transition = zoomViewportToDepthSpan(
    {
      depthDomain: config.depthDomain,
      containerHeight: config.containerHeight,
      headerHeight: config.headerHeight,
      pixelsPerDepth: current.viewport.pixelsPerDepth,
      scrollTop: current.viewport.scrollTop,
      minPixelsPerDepth: current.defaultScale,
    },
    fromDepth,
    toDepth,
    minDepthSpan,
  );
  return resolveLogViewportController(config, {
    pixelsPerDepth: transition.pixelsPerDepth,
    scrollTop: transition.scrollTop,
    zoomPinned: transition.pixelsPerDepth > current.defaultScale + config.zoomEpsilon,
  });
}
