import { depthSpanSize, normalizeDepthSpan, type DepthSpan } from "./depthDomain";
import { createDepthScale, type DepthScale } from "./depthScale";

export type LogViewportConfig = {
  depthDomain: DepthSpan;
  containerHeight: number;
  headerHeight: number;
  pixelsPerDepth: number;
  scrollTop: number;
  minPixelsPerDepth?: number;
  maxPixelsPerDepth?: number;
};

export type LogViewportState = {
  depthDomain: DepthSpan;
  visibleDepthSpan: DepthSpan;
  scale: DepthScale;
  pixelsPerDepth: number;
  minPixelsPerDepth: number;
  maxPixelsPerDepth: number;
  bodyHeight: number;
  contentHeight: number;
  visibleBodyHeight: number;
  scrollTop: number;
  maxScrollTop: number;
};

export type LogViewportTransition = {
  pixelsPerDepth: number;
  scrollTop: number;
  viewport: LogViewportState;
};

export type LogPointerPosition = {
  contentY: number;
  viewportBodyY: number;
  depth: number;
};

const DEFAULT_CONTAINER_HEIGHT = 640;
const MIN_PIXELS_PER_DEPTH = 0.05;
const MAX_PIXELS_PER_DEPTH = 256;

export function clampToBounds(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function defaultPixelsPerDepth(
  depthDomain: DepthSpan,
  containerHeight: number,
  headerHeight: number,
) {
  const domainSpan = Math.max(0.001, depthSpanSize(depthDomain));
  const visibleBodyHeight = getVisibleBodyHeight(containerHeight, headerHeight);
  return Math.max(MIN_PIXELS_PER_DEPTH, visibleBodyHeight / domainSpan);
}

export function pixelsPerDepthForSpan(
  depthSpan: number,
  visibleBodyHeight: number,
  minPixelsPerDepth = MIN_PIXELS_PER_DEPTH,
  maxPixelsPerDepth = MAX_PIXELS_PER_DEPTH,
) {
  const requested = visibleBodyHeight / Math.max(0.001, depthSpan);
  const safeMaxPixelsPerDepth = Math.max(minPixelsPerDepth, maxPixelsPerDepth);
  return clampToBounds(requested, minPixelsPerDepth, safeMaxPixelsPerDepth);
}

export function resolveLogViewport(config: LogViewportConfig): LogViewportState {
  const depthDomain = normalizeDepthSpan(config.depthDomain);
  const domainSpan = Math.max(0.001, depthSpanSize(depthDomain));
  const minPixelsPerDepth = config.minPixelsPerDepth ?? defaultPixelsPerDepth(
    depthDomain,
    config.containerHeight,
    config.headerHeight,
  );
  const maxPixelsPerDepth = Math.max(minPixelsPerDepth, config.maxPixelsPerDepth ?? MAX_PIXELS_PER_DEPTH);
  const pixelsPerDepth = clampToBounds(config.pixelsPerDepth, minPixelsPerDepth, maxPixelsPerDepth);
  const visibleBodyHeight = getVisibleBodyHeight(config.containerHeight, config.headerHeight);
  const bodyHeight = Math.max(visibleBodyHeight, Math.ceil(domainSpan * pixelsPerDepth));
  const contentHeight = config.headerHeight + bodyHeight;
  const safeContainerHeight = Math.max(1, config.containerHeight || DEFAULT_CONTAINER_HEIGHT);
  const maxScrollTop = Math.max(0, contentHeight - safeContainerHeight);
  const scrollTop = clampToBounds(config.scrollTop, 0, maxScrollTop);

  const visibleFromDepth = depthDomain.fromDepth + (scrollTop / bodyHeight) * domainSpan;
  const visibleToDepth = depthDomain.fromDepth + ((scrollTop + visibleBodyHeight) / bodyHeight) * domainSpan;
  const visibleDepthSpan = {
    fromDepth: clampToBounds(visibleFromDepth, depthDomain.fromDepth, depthDomain.toDepth),
    toDepth: clampToBounds(visibleToDepth, depthDomain.fromDepth, depthDomain.toDepth),
  };
  const scale = createDepthScale(
    depthDomain.toDepth,
    contentHeight,
    config.headerHeight,
    visibleDepthSpan.fromDepth,
    visibleDepthSpan.toDepth,
    depthDomain.fromDepth,
    depthDomain.toDepth,
  );

  return {
    depthDomain,
    visibleDepthSpan,
    scale,
    pixelsPerDepth,
    minPixelsPerDepth,
    maxPixelsPerDepth,
    bodyHeight,
    contentHeight,
    visibleBodyHeight,
    scrollTop,
    maxScrollTop,
  };
}

export function scrollTopForDepthAtViewportY(
  scale: DepthScale,
  depth: number,
  viewportBodyY: number,
  maxScrollTop: number,
) {
  return clampToBounds(scale.depthToY(depth) - viewportBodyY, 0, maxScrollTop);
}

export function resolveLogPointerPosition(
  viewport: Pick<LogViewportState, "scale" | "scrollTop" | "visibleBodyHeight">,
  clientY: number,
  bodyTop: number,
): LogPointerPosition {
  const contentY = clampToBounds(clientY - bodyTop, 0, viewport.scale.drawableHeight);
  return {
    contentY,
    viewportBodyY: clampToBounds(contentY - viewport.scrollTop, 0, viewport.visibleBodyHeight),
    depth: viewport.scale.yToDepth(contentY),
  };
}

export function zoomViewportAtDepth(
  config: LogViewportConfig,
  depth: number,
  factor: number,
  viewportBodyY?: number,
): LogViewportTransition {
  const currentViewport = resolveLogViewport(config);
  const nextPixelsPerDepth = clampToBounds(
    currentViewport.pixelsPerDepth * factor,
    currentViewport.minPixelsPerDepth,
    currentViewport.maxPixelsPerDepth,
  );
  const nextViewportAtTop = resolveLogViewport({
    ...config,
    pixelsPerDepth: nextPixelsPerDepth,
    scrollTop: 0,
  });
  const nextScrollTop = scrollTopForDepthAtViewportY(
    nextViewportAtTop.scale,
    depth,
    viewportBodyY ?? currentViewport.visibleBodyHeight / 2,
    nextViewportAtTop.maxScrollTop,
  );
  const nextViewport = resolveLogViewport({
    ...config,
    pixelsPerDepth: nextPixelsPerDepth,
    scrollTop: nextScrollTop,
  });

  return {
    pixelsPerDepth: nextViewport.pixelsPerDepth,
    scrollTop: nextViewport.scrollTop,
    viewport: nextViewport,
  };
}

export function zoomViewportToDepthSpan(
  config: LogViewportConfig,
  fromDepth: number,
  toDepth: number,
  minDepthSpan = 0.05,
): LogViewportTransition {
  const currentViewport = resolveLogViewport(config);
  const startDepth = clampToBounds(
    Math.min(fromDepth, toDepth),
    currentViewport.depthDomain.fromDepth,
    currentViewport.depthDomain.toDepth,
  );
  const endDepth = clampToBounds(
    Math.max(fromDepth, toDepth),
    currentViewport.depthDomain.fromDepth,
    currentViewport.depthDomain.toDepth,
  );
  const requestedSpan = Math.max(minDepthSpan, endDepth - startDepth);
  const nextPixelsPerDepth = pixelsPerDepthForSpan(
    requestedSpan,
    currentViewport.visibleBodyHeight,
    currentViewport.minPixelsPerDepth,
    currentViewport.maxPixelsPerDepth,
  );
  const nextViewportAtTop = resolveLogViewport({
    ...config,
    pixelsPerDepth: nextPixelsPerDepth,
    scrollTop: 0,
  });
  const nextScrollTop = scrollTopForDepthAtViewportY(nextViewportAtTop.scale, startDepth, 0, nextViewportAtTop.maxScrollTop);
  const nextViewport = resolveLogViewport({
    ...config,
    pixelsPerDepth: nextPixelsPerDepth,
    scrollTop: nextScrollTop,
  });

  return {
    pixelsPerDepth: nextViewport.pixelsPerDepth,
    scrollTop: nextViewport.scrollTop,
    viewport: nextViewport,
  };
}

function getVisibleBodyHeight(containerHeight: number, headerHeight: number) {
  const safeContainerHeight = Math.max(1, containerHeight || DEFAULT_CONTAINER_HEIGHT);
  return Math.max(1, safeContainerHeight - headerHeight);
}
