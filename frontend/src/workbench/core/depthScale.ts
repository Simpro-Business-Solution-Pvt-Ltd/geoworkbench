import { scaleLinear } from "d3-scale";

export type DepthScale = {
  fromDepth: number;
  toDepth: number;
  totalDepth: number;
  domainFromDepth: number;
  domainToDepth: number;
  clampFromDepth: number;
  clampToDepth: number;
  visibleSpan: number;
  domainSpan: number;
  contentHeight: number;
  topOffset: number;
  drawableHeight: number;
  depthToY: (depth: number) => number;
  yToDepth: (y: number) => number;
  depthToContentPercent: (depth: number) => number;
  depthToPercent: (depth: number) => number;
  intervalToStyle: (fromDepth: number, toDepth: number) => { top: string; height: string };
  contentToDepth: (y: number) => number;
  depthToContentY: (depth: number) => number;
};

export function clampDepth(depth: number, minDepth: number, maxDepth: number): number {
  return Math.max(minDepth, Math.min(maxDepth, depth));
}

function unclampedDepthToPercentFromDepth(depth: number, fromDepth: number, visibleSpan: number): number {
  return ((depth - fromDepth) / visibleSpan) * 100;
}

function createDepthToContentTransform(domainFromDepth: number, domainToDepth: number, drawableHeight: number) {
  const domainSpan = Math.max(0.001, domainToDepth - domainFromDepth);
  const depthToYScale = scaleLinear()
    .domain([domainFromDepth, domainToDepth])
    .range([0, drawableHeight])
    .clamp(true);

  return {
    domainSpan,
    depthToY: (depth: number) => depthToYScale(depth),
    yToDepth: (y: number) => depthToYScale.invert(Math.max(0, Math.min(drawableHeight, y))),
    depthToContentY: (depth: number) => depthToYScale(depth),
    contentToDepth: (y: number) => depthToYScale.invert(Math.max(0, Math.min(drawableHeight, y))),
    displayToContentY: (y: number) => Math.max(0, Math.min(drawableHeight, y)),
  };
}

export function createDepthScale(
  totalDepth: number,
  contentHeight: number,
  topOffset = 42,
  fromDepth = 0,
  toDepth = totalDepth,
  domainFromDepth = 0,
  domainToDepth = totalDepth,
): DepthScale {
  const safeClampFrom = Math.min(domainFromDepth, domainToDepth);
  const safeClampTo = Math.max(domainFromDepth, domainToDepth);
  const safeFrom = clampDepth(Math.min(fromDepth, toDepth), safeClampFrom, safeClampTo);
  const safeTo = clampDepth(Math.max(fromDepth, toDepth), safeClampFrom, safeClampTo);
  const drawableHeight = Math.max(1, contentHeight - topOffset);
  const transform = createDepthToContentTransform(safeClampFrom, safeClampTo, drawableHeight);
  const visibleSpan = Math.max(0.001, safeTo - safeFrom);

  return {
    fromDepth: safeFrom,
    toDepth: safeTo,
    totalDepth,
    domainFromDepth: safeClampFrom,
    domainToDepth: safeClampTo,
    clampFromDepth: safeClampFrom,
    clampToDepth: safeClampTo,
    visibleSpan,
    domainSpan: transform.domainSpan,
    contentHeight,
    topOffset,
    drawableHeight,
    depthToY: (depth) => transform.depthToContentY(clampDepth(depth, safeClampFrom, safeClampTo)),
    yToDepth: (y) => clampDepth(transform.contentToDepth(transform.displayToContentY(y)), safeClampFrom, safeClampTo),
    depthToContentPercent: (depth) =>
      unclampedDepthToPercentFromDepth(clampDepth(depth, safeClampFrom, safeClampTo), safeClampFrom, transform.domainSpan),
    depthToPercent: (depth) =>
      ((topOffset + transform.depthToContentY(clampDepth(depth, safeClampFrom, safeClampTo))) / contentHeight) * 100,
    intervalToStyle: (fromDepth, toDepth) => {
      const startY = transform.depthToContentY(clampDepth(Math.min(fromDepth, toDepth), safeClampFrom, safeClampTo));
      const endY = transform.depthToContentY(clampDepth(Math.max(fromDepth, toDepth), safeClampFrom, safeClampTo));
      return {
        top: `${startY}px`,
        height: `${Math.max(1, endY - startY)}px`,
      };
    },
    contentToDepth: transform.contentToDepth,
    depthToContentY: transform.depthToContentY,
  };
}
