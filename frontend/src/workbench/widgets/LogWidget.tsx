import {
  type CSSProperties,
  type RefObject,
  type UIEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../api/types";
import { depthSpanSize, inferLogWidgetDepthSpan } from "../core/depthDomain";
import type { LogTrackContext } from "../core/logTrackContext";
import {
  clampToBounds,
  defaultPixelsPerDepth,
  pixelsPerDepthForSpan,
  resolveLogViewport,
  scrollTopForDepthAtViewportY,
} from "../core/logViewport";
import { handleTrackPointerEvent } from "../core/interactions";
import { legendForIntervals } from "../core/lithologyPatterns";
import type { TrackPointerEvent } from "../core/trackObject";
import { useWorkbenchStore } from "../display/workbenchStore";
import { AiSuggestionsTrack } from "../tracks/aiSuggestions/AiSuggestionsTrack";
import { CurveTrack } from "../tracks/curve/CurveTrack";
import { DepthTrack } from "../tracks/depth/DepthTrack";
import { ImageTrack } from "../tracks/images/ImageTrack";
import { LithologyTrack } from "../tracks/lithology/LithologyTrack";
import { QuantitativeBarTrack } from "../tracks/quantitativeBar/QuantitativeBarTrack";
import { RemarksTrack } from "../tracks/remarks/RemarksTrack";
import { SeamTrack } from "../tracks/seam/SeamTrack";

type Props = {
  data: BoreholeWorkbench;
};

type DragSelection = {
  startDepth: number;
  startY: number;
  currentDepth: number;
  currentY: number;
};

type RulerState = {
  depth: number;
  y: number;
};

const DEFAULT_HEADER_HEIGHT = 38;
const DEFAULT_HEADER_SCALE_BASE = 34;
const DEFAULT_CONTAINER_HEIGHT = 640;
const RECTANGULAR_ZOOM_MIN_PIXELS = 8;
const RECTANGULAR_ZOOM_MIN_DEPTH = 0.05;
const ZOOM_IN_FACTOR = 1.35;
const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR;
const ZOOM_EPSILON = 0.01;

export function LogWidget({ data }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollTop = useRef<number | null>(null);
  const dragSelectionRef = useRef<DragSelection | null>(null);
  const store = useWorkbenchStore();
  const {
    selectedDepth,
    contextMenu,
    setContextMenu,
    setSelectedDepth,
    setHoveredObject,
    tooltipsEnabled,
    setTooltipsEnabled,
  } = store;
  const [scrollTop, setScrollTop] = useState(0);
  const [pixelsPerDepth, setPixelsPerDepth] = useState(1);
  const [zoomPinned, setZoomPinned] = useState(false);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [ruler, setRuler] = useState<RulerState | null>(null);
  const containerHeight = useElementHeight(scrollRef, DEFAULT_CONTAINER_HEIGHT);

  const tracks = data.layout?.settings.widgets?.["log-widget"]?.tracks ?? [];
  const visibleTracks = useMemo(() => tracks.filter((track) => track.visible), [tracks]);
  const depthDomain = useMemo(() => inferLogWidgetDepthSpan(data, visibleTracks), [data, visibleTracks]);
  const maxVisibleCurves = Math.max(
    0,
    ...visibleTracks
      .filter((track) => track.type === "curve")
      .map((track) => track.curves?.filter((curve) => curve.visible).length ?? 0),
  );
  const headerHeight = Math.max(
    DEFAULT_HEADER_HEIGHT,
    maxVisibleCurves > 0 ? DEFAULT_HEADER_SCALE_BASE + maxVisibleCurves * 13 : DEFAULT_HEADER_HEIGHT,
  );
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
  const isZoomed = viewport.pixelsPerDepth > defaultScale + ZOOM_EPSILON;
  const lithologyLegend = legendForIntervals(data.lithology_intervals);
  const widthForTrack = useMemo(() => {
    if (!visibleTracks.length) return () => "100%";
    const totalConfiguredWidth = visibleTracks.reduce((sum, track) => sum + Math.max(1, track.width), 0);
    return (track: DisplayTrack) => `${(Math.max(1, track.width) / totalConfiguredWidth) * 100}%`;
  }, [visibleTracks]);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  function setDragSelectionState(selection: DragSelection | null) {
    dragSelectionRef.current = selection;
    setDragSelection(selection);
  }

  const syncScrollElement = useCallback((nextScrollTop: number, maxScrollTop = viewportRef.current.maxScrollTop) => {
    const clamped = clampToBounds(nextScrollTop, 0, maxScrollTop);
    pendingScrollTop.current = clamped;
    setScrollTop(clamped);
  }, []);

  useLayoutEffect(() => {
    const target = pendingScrollTop.current;
    if (target === null || !scrollRef.current) return;
    const clamped = clampToBounds(target, 0, viewport.maxScrollTop);
    scrollRef.current.scrollTop = clamped;
    setScrollTop(clamped);
    pendingScrollTop.current = null;
  }, [viewport.contentHeight, viewport.maxScrollTop]);

  useEffect(() => {
    setPixelsPerDepth(defaultScale);
    setZoomPinned(false);
    syncScrollElement(0);
    setDragSelectionState(null);
    setRuler(null);
  }, [data.id, syncScrollElement]);

  useEffect(() => {
    if (!zoomPinned) {
      setPixelsPerDepth(defaultScale);
    }
  }, [defaultScale, zoomPinned]);

  useEffect(() => {
    if (scrollTop <= viewport.maxScrollTop) return;
    syncScrollElement(viewport.maxScrollTop);
  }, [scrollTop, syncScrollElement, viewport.maxScrollTop]);

  const resolvePointerDepth = useCallback(
    (clientY: number) => {
      const body = scrollRef.current?.querySelector<HTMLElement>(".track-body");
      const containerBounds = scrollRef.current?.getBoundingClientRect();
      const fallbackTop = (containerBounds?.top ?? 0) + headerHeight - viewport.scrollTop;
      const bodyTop = body?.getBoundingClientRect().top ?? fallbackTop;
      const contentY = clampToBounds(clientY - bodyTop, 0, viewport.scale.drawableHeight);
      const viewportBodyY = clampToBounds(contentY - viewport.scrollTop, 0, viewport.visibleBodyHeight);
      return {
        contentY,
        viewportBodyY,
        depth: viewport.scale.yToDepth(contentY),
      };
    },
    [headerHeight, viewport],
  );

  const applyZoomAtDepth = useCallback(
    (depth: number, factor: number, viewportBodyY = viewport.visibleBodyHeight / 2) => {
      const nextPixelsPerDepth = clampToBounds(
        viewport.pixelsPerDepth * factor,
        viewport.minPixelsPerDepth,
        viewport.maxPixelsPerDepth,
      );
      const nextViewport = resolveLogViewport({
        depthDomain,
        containerHeight,
        headerHeight,
        pixelsPerDepth: nextPixelsPerDepth,
        scrollTop: 0,
        minPixelsPerDepth: defaultScale,
      });
      const nextScrollTop = scrollTopForDepthAtViewportY(
        nextViewport.scale,
        depth,
        viewportBodyY,
        nextViewport.maxScrollTop,
      );
      setPixelsPerDepth(nextPixelsPerDepth);
      setZoomPinned(nextPixelsPerDepth > defaultScale + ZOOM_EPSILON);
      syncScrollElement(nextScrollTop, nextViewport.maxScrollTop);
    },
    [containerHeight, defaultScale, depthDomain, headerHeight, syncScrollElement, viewport],
  );

  const zoomToDepthWindow = useCallback(
    (fromDepth: number, toDepth: number) => {
      const startDepth = clampToBounds(Math.min(fromDepth, toDepth), depthDomain.fromDepth, depthDomain.toDepth);
      const endDepth = clampToBounds(Math.max(fromDepth, toDepth), depthDomain.fromDepth, depthDomain.toDepth);
      const requestedSpan = Math.max(RECTANGULAR_ZOOM_MIN_DEPTH, endDepth - startDepth);
      const nextPixelsPerDepth = pixelsPerDepthForSpan(
        requestedSpan,
        viewport.visibleBodyHeight,
        viewport.minPixelsPerDepth,
        viewport.maxPixelsPerDepth,
      );
      const nextViewport = resolveLogViewport({
        depthDomain,
        containerHeight,
        headerHeight,
        pixelsPerDepth: nextPixelsPerDepth,
        scrollTop: 0,
        minPixelsPerDepth: defaultScale,
      });
      const nextScrollTop = scrollTopForDepthAtViewportY(nextViewport.scale, startDepth, 0, nextViewport.maxScrollTop);
      setPixelsPerDepth(nextPixelsPerDepth);
      setZoomPinned(nextPixelsPerDepth > defaultScale + ZOOM_EPSILON);
      syncScrollElement(nextScrollTop, nextViewport.maxScrollTop);
    },
    [containerHeight, defaultScale, depthDomain, headerHeight, syncScrollElement, viewport],
  );

  const resetToFullDepth = useCallback(() => {
    setPixelsPerDepth(defaultScale);
    setZoomPinned(false);
    syncScrollElement(0);
  }, [defaultScale, syncScrollElement]);

  const dispatchTrackEvent = useCallback(
    (event: TrackPointerEvent) => {
      if (event.type === "hover") {
        setRuler({ depth: event.depth, y: event.localY });
        handleTrackPointerEvent(event, store);
        return;
      }

      if (event.type === "contextmenu") {
        setRuler({ depth: event.depth, y: event.localY });
        handleTrackPointerEvent(event, store);
        return;
      }

      if (event.type === "dragstart") {
        const nextSelection = {
          startDepth: event.depth,
          startY: event.localY,
          currentDepth: event.depth,
          currentY: event.localY,
        };
        setDragSelectionState(nextSelection);
        setRuler({ depth: event.depth, y: event.localY });
        setSelectedDepth(event.depth);
        return;
      }

      if (event.type === "drag") {
        const currentSelection = dragSelectionRef.current;
        if (!currentSelection) return;
        const nextSelection = {
          ...currentSelection,
          currentDepth: event.depth,
          currentY: event.localY,
        };
        setDragSelectionState(nextSelection);
        setRuler({ depth: event.depth, y: event.localY });
        setSelectedDepth(event.depth);
        return;
      }

      if (event.type === "dragend") {
        const currentSelection = dragSelectionRef.current;
        setRuler({ depth: event.depth, y: event.localY });
        if (currentSelection) {
          const finishedSelection = {
            ...currentSelection,
            currentDepth: event.depth,
            currentY: event.localY,
          };
          const pixelDelta = Math.abs(finishedSelection.currentY - finishedSelection.startY);
          const fromDepth = Math.min(finishedSelection.startDepth, finishedSelection.currentDepth);
          const toDepth = Math.max(finishedSelection.startDepth, finishedSelection.currentDepth);
          setDragSelectionState(null);
          if (pixelDelta >= RECTANGULAR_ZOOM_MIN_PIXELS && toDepth - fromDepth >= RECTANGULAR_ZOOM_MIN_DEPTH) {
            zoomToDepthWindow(fromDepth, toDepth);
            return;
          }
        }
        handleTrackPointerEvent({ ...event, type: "click" }, store);
      }
    },
    [setSelectedDepth, store, zoomToDepthWindow],
  );

  const trackContext = useMemo<LogTrackContext>(
    () => ({
      data,
      scale: viewport.scale,
      depthDomain,
      visibleDepthSpan: viewport.visibleDepthSpan,
      widthForTrack,
      dispatchTrackEvent,
    }),
    [data, depthDomain, dispatchTrackEvent, viewport.scale, viewport.visibleDepthSpan, widthForTrack],
  );

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.altKey && !event.ctrlKey) return;
    event.preventDefault();
    const pointer = resolvePointerDepth(event.clientY);
    applyZoomAtDepth(pointer.depth, event.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR, pointer.viewportBodyY);
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const selectedDepthY = selectedDepth === null ? null : viewport.scale.depthToY(selectedDepth);
  const domainSpan = depthSpanSize(depthDomain);
  const rulerLabel = ruler ? `${ruler.depth.toFixed(2)} m` : "";

  return (
    <div className="log-widget">
      <LogWidgetHeader
        data={data}
        visibleTracks={visibleTracks.length}
        visibleCurves={maxVisibleCurves}
      />
      <div className="lithology-legend">
        {lithologyLegend.map((item) => (
          <span key={item.code}>
            <i className={`lithology-pattern ${item.className}`} style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div
        className="track-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        <div
          className="track-row"
          style={
            {
              height: viewport.contentHeight,
              "--track-header-height": `${headerHeight}px`,
            } as CSSProperties
          }
          onMouseLeave={() => {
            setRuler(null);
            setHoveredObject(null);
            setDragSelectionState(null);
          }}
        >
          {visibleTracks.map((track) => renderTrack(track, data, trackContext))}
          {visibleTracks.length === 0 && <div className="log-track-empty">No visible log tracks</div>}
          {ruler && (
            <div className="depth-ruler" style={{ top: `${viewport.scale.topOffset + ruler.y}px` }}>
              <span>{rulerLabel}</span>
            </div>
          )}
          {selectedDepthY !== null && (
            <div className="crosshair" style={{ top: `${viewport.scale.topOffset + selectedDepthY}px` }} />
          )}
          {dragSelection && (
            <div
              className="rubber-band"
              style={{
                top: Math.min(dragSelection.startY, dragSelection.currentY) + viewport.scale.topOffset,
                height: Math.abs(dragSelection.currentY - dragSelection.startY),
              }}
            >
              <span>
                {Math.min(dragSelection.startDepth, dragSelection.currentDepth).toFixed(2)}m -{" "}
                {Math.max(dragSelection.startDepth, dragSelection.currentDepth).toFixed(2)}m
              </span>
            </div>
          )}
          {contextMenu && (
            <LogContextMenu
              depth={contextMenu.depth}
              trackType={contextMenu.trackType}
              objectKind={contextMenu.object.kind}
              x={contextMenu.x}
              y={contextMenu.y}
              tooltipsEnabled={tooltipsEnabled}
              onZoomIn={() => {
                applyZoomAtDepth(contextMenu.depth, ZOOM_IN_FACTOR);
                setContextMenu(null);
              }}
              onZoomOut={() => {
                applyZoomAtDepth(contextMenu.depth, ZOOM_OUT_FACTOR);
                setContextMenu(null);
              }}
              onFullDepth={() => {
                resetToFullDepth();
                setContextMenu(null);
              }}
              onToggleTooltips={() => {
                setTooltipsEnabled(!tooltipsEnabled);
                setContextMenu(null);
              }}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>
      </div>
      <LogWidgetFooter
        visibleFromDepth={viewport.visibleDepthSpan.fromDepth}
        visibleToDepth={viewport.visibleDepthSpan.toDepth}
        domainFromDepth={depthDomain.fromDepth}
        domainToDepth={depthDomain.toDepth}
        scaleLabel={viewport.pixelsPerDepth.toFixed(viewport.pixelsPerDepth >= 10 ? 1 : 2)}
        domainSpan={domainSpan}
        isZoomed={isZoomed}
        tooltipsEnabled={tooltipsEnabled}
        onZoomIn={() => applyZoomAtDepth(selectedDepth ?? midpoint(viewport.visibleDepthSpan), ZOOM_IN_FACTOR)}
        onZoomOut={() => applyZoomAtDepth(selectedDepth ?? midpoint(viewport.visibleDepthSpan), ZOOM_OUT_FACTOR)}
        onFullDepth={resetToFullDepth}
        onToggleTooltips={() => setTooltipsEnabled(!tooltipsEnabled)}
      />
    </div>
  );
}

function renderTrack(track: DisplayTrack, data: BoreholeWorkbench, context: LogTrackContext) {
  if (track.type === "depthAxis") return <DepthTrack key={track.id} data={data} track={track} context={context} />;
  if (track.type === "lithology") return <LithologyTrack key={track.id} data={data} track={track} context={context} />;
  if (track.type === "seam") return <SeamTrack key={track.id} data={data} track={track} context={context} />;
  if (track.type === "images") return <ImageTrack key={track.id} data={data} track={track} context={context} />;
  if (track.type === "curve") return <CurveTrack key={track.id} data={data} track={track} context={context} />;
  if (track.type === "quantitativeBar") {
    return <QuantitativeBarTrack key={track.id} data={data} track={track} context={context} />;
  }
  if (track.type === "remarks") return <RemarksTrack key={track.id} data={data} track={track} context={context} />;
  if (track.type === "aiSuggestions") {
    return <AiSuggestionsTrack key={track.id} data={data} track={track} context={context} />;
  }
  return (
    <div key={track.id} className="track" style={{ width: context.widthForTrack(track) }}>
      <div className="track-title">{track.title}</div>
    </div>
  );
}

function LogWidgetHeader({
  data,
  visibleTracks,
  visibleCurves,
}: {
  data: BoreholeWorkbench;
  visibleTracks: number;
  visibleCurves: number;
}) {
  return (
    <div className="log-header">
      <div>
        <h1>{data.title}</h1>
        <p>
          {data.code} · {data.state ?? "Unknown state"} · {data.total_depth} m · {data.source_workbook}
        </p>
      </div>
      <span className="status-pill">
        {visibleTracks} tracks · {visibleCurves} curves
      </span>
    </div>
  );
}

function LogWidgetFooter({
  visibleFromDepth,
  visibleToDepth,
  domainFromDepth,
  domainToDepth,
  scaleLabel,
  domainSpan,
  isZoomed,
  tooltipsEnabled,
  onZoomIn,
  onZoomOut,
  onFullDepth,
  onToggleTooltips,
}: {
  visibleFromDepth: number;
  visibleToDepth: number;
  domainFromDepth: number;
  domainToDepth: number;
  scaleLabel: string;
  domainSpan: number;
  isZoomed: boolean;
  tooltipsEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullDepth: () => void;
  onToggleTooltips: () => void;
}) {
  return (
    <div className="log-footer">
      <span>
        Visible {visibleFromDepth.toFixed(2)}-{visibleToDepth.toFixed(2)} m
      </span>
      <span>
        Domain {domainFromDepth.toFixed(2)}-{domainToDepth.toFixed(2)} m ({domainSpan.toFixed(2)} m)
      </span>
      <span>{scaleLabel} px/m</span>
      <button type="button" onClick={onZoomIn}>Zoom in</button>
      <button type="button" onClick={onZoomOut}>Zoom out</button>
      <button type="button" onClick={onFullDepth} disabled={!isZoomed}>
        Full depth
      </button>
      <button type="button" onClick={onToggleTooltips}>
        {tooltipsEnabled ? "Tooltips on" : "Tooltips off"}
      </button>
    </div>
  );
}

function LogContextMenu({
  depth,
  trackType,
  objectKind,
  x,
  y,
  tooltipsEnabled,
  onZoomIn,
  onZoomOut,
  onFullDepth,
  onToggleTooltips,
  onClose,
}: {
  depth: number;
  trackType: string;
  objectKind: string;
  x: number;
  y: number;
  tooltipsEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullDepth: () => void;
  onToggleTooltips: () => void;
  onClose: () => void;
}) {
  return (
    <div className="track-context-menu" style={{ left: x, top: y }}>
      <strong>{trackType}</strong>
      <span>{depth.toFixed(2)} m</span>
      <span>{objectKind}</span>
      <button type="button" onClick={onZoomIn}>Zoom in here</button>
      <button type="button" onClick={onZoomOut}>Zoom out here</button>
      <button type="button" onClick={onFullDepth}>Full depth</button>
      <button type="button" onClick={onToggleTooltips}>
        {tooltipsEnabled ? "Disable tooltips" : "Enable tooltips"}
      </button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  );
}

function midpoint(span: { fromDepth: number; toDepth: number }) {
  return (span.fromDepth + span.toDepth) / 2;
}

function useElementHeight(ref: RefObject<HTMLElement | null>, fallback: number) {
  const [height, setHeight] = useState(fallback);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      setHeight(Math.max(1, element.clientHeight || fallback));
    };

    update();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback, ref]);

  return height;
}
