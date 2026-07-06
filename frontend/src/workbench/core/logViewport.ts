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

const DEFAULT_CONTAINER_HEIGHT = 640;
const MIN_PIXELS_PER_DEPTH = 1.2;
const MAX_PIXELS_PER_DEPTH = 64;

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

function getVisibleBodyHeight(containerHeight: number, headerHeight: number) {
  const safeContainerHeight = Math.max(1, containerHeight || DEFAULT_CONTAINER_HEIGHT);
  return Math.max(1, safeContainerHeight - headerHeight);
}
