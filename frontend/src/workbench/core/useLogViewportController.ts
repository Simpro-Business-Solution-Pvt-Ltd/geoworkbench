import type { DepthSpan } from "./depthDomain";
import { useLogWidgetControlPlane } from "./useLogWidgetControlPlane";

type UseLogViewportControllerConfig = {
  depthDomain: DepthSpan;
  containerHeight: number;
  headerHeight: number;
  scrollElement: HTMLDivElement | null;
  resetKey: string | number;
  zoomEpsilon: number;
};

export function useLogViewportController(config: UseLogViewportControllerConfig) {
  const { controlPlane, isZoomed, zoomAtDepth, zoomToDepthWindow, resetFullDepth, scrollTo } =
    useLogWidgetControlPlane(config);

  return {
    viewport: controlPlane.snapshot.viewport,
    defaultScale: controlPlane.snapshot.defaultScale,
    isZoomed,
    applyZoomAtDepth: zoomAtDepth,
    zoomToDepthWindow,
    resetToFullDepth: resetFullDepth,
    setScrollTop: scrollTo,
  };
}
