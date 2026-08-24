import {
  type UIEvent,
  type DragEvent,
  type WheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { BoreholeWorkbench, DisplayTrack, DisplayWidget } from "../../../api/types";
import { addBottomDepthPadding, depthSpanSize, inferLogWidgetDepthSpan } from "../../core/depthDomain";
import type { LogTrackContext } from "../../core/logTrackContext";
import { buildLogWidgetControlPlaneDiagnostics } from "../../core/logViewportDiagnostics";
import { useLogWidgetControlPlane } from "../../core/useLogWidgetControlPlane";
import { handleTrackPointerEvent } from "../../core/interactions";
import { legendForIntervals } from "../../core/lithologyPatterns";
import type { TrackPointerEvent } from "../../core/trackObject";
import { resolveLogWidgetDrop } from "../../display/logWidgetDropResolver";
import { useWorkbenchStore } from "../../display/workbenchStore";
import { BOREHOLE_EXPLORER_DRAG_MIME_TYPE } from "../../explorer/BoreholeExplorer";
import { renderRegisteredTrack } from "../../tracks/trackRegistry";
import { LogContextMenu } from "./LogContextMenu";
import { LogWidgetFooter } from "./LogWidgetFooter";
import { LogWidgetHeader } from "./LogWidgetHeader";
import { useElementHeight } from "./useElementHeight";

type Props = {
  data: BoreholeWorkbench;
  widgetKey?: string;
  widget?: DisplayWidget;
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

export function LogWidget({ data, widgetKey = "log-widget", widget }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
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
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [ruler, setRuler] = useState<RulerState | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(false);
  const [runtimeTracks, setRuntimeTracks] = useState<DisplayTrack[] | null>(null);
  const [dropMessage, setDropMessage] = useState<string | null>(null);
  const containerHeight = useElementHeight(scrollRef, DEFAULT_CONTAINER_HEIGHT);

  const sourceWidget = useMemo<DisplayWidget>(
    () => widget ?? data.layout?.settings.widgets?.["log-widget"] ?? { type: "logWidget", title: "Borehole Log", tracks: [] },
    [data.layout, widget],
  );
  const tracks = runtimeTracks ?? sourceWidget.tracks ?? [];
  const visibleTracks = useMemo(() => tracks.filter((track) => track.visible), [tracks]);
  const depthDomain = useMemo(
    () => addBottomDepthPadding(inferLogWidgetDepthSpan(data, visibleTracks)),
    [data, visibleTracks],
  );
  const maxVisibleCurves = Math.max(
    0,
    ...visibleTracks
      .filter((track) => track.type === "curve")
      .map((track) => track.curves?.filter((curve) => curve.visible).length ?? 0),
  );
  const headerHeight = Math.max(
    DEFAULT_HEADER_HEIGHT,
    maxVisibleCurves > 0 ? DEFAULT_HEADER_SCALE_BASE + maxVisibleCurves * 13 : DEFAULT_HEADER_HEIGHT,
    ...visibleTracks.map((track) => track.header?.height ?? 0),
  );
  const { controlPlane, isZoomed, zoomAtDepth, zoomToDepthWindow, resetFullDepth, scrollTo } =
    useLogWidgetControlPlane({
      depthDomain,
      containerHeight,
      headerHeight,
      scrollElement,
      resetKey: `${data.id}:${widgetKey}:${sourceWidget.tracks?.map((track) => track.id).join("|") ?? ""}`,
      zoomEpsilon: ZOOM_EPSILON,
    });
  const viewport = controlPlane.snapshot.viewport;
  const lithologyLegend = legendForIntervals(data.lithology_intervals);
  const widthForTrack = useMemo(() => {
    if (!visibleTracks.length) return () => "100%";
    const totalConfiguredWidth = visibleTracks.reduce((sum, track) => sum + Math.max(1, track.width), 0);
    return (track: DisplayTrack) => `${(Math.max(1, track.width) / totalConfiguredWidth) * 100}%`;
  }, [visibleTracks]);

  function setDragSelectionState(selection: DragSelection | null) {
    dragSelectionRef.current = selection;
    setDragSelection(selection);
  }

  useEffect(() => {
    setDragSelectionState(null);
    setRuler(null);
    setRuntimeTracks(null);
    setDropMessage(null);
  }, [data.id, sourceWidget]);

  const resolvePointerDepth = useCallback(
    (clientY: number) => {
      const body = scrollRef.current?.querySelector<HTMLElement>(".track-body");
      const containerBounds = scrollRef.current?.getBoundingClientRect();
      const fallbackTop = (containerBounds?.top ?? 0) + headerHeight - viewport.scrollTop;
      const bodyBounds = body?.getBoundingClientRect();
      const pointer = controlPlane.resolvePointer(0, clientY, {
        left: bodyBounds?.left ?? 0,
        top: bodyBounds?.top ?? fallbackTop,
      });
      return { depth: pointer.depth, viewportBodyY: pointer.viewportY };
    },
    [controlPlane, headerHeight, viewport.scrollTop],
  );

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
            zoomToDepthWindow(fromDepth, toDepth, RECTANGULAR_ZOOM_MIN_DEPTH);
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
      controlPlane,
      scale: viewport.scale,
      headerHeight,
      depthDomain: controlPlane.virtualDepth,
      visibleDepthSpan: viewport.visibleDepthSpan,
      widthForTrack,
      dispatchTrackEvent,
    }),
    [controlPlane, data, dispatchTrackEvent, headerHeight, viewport.scale, viewport.visibleDepthSpan, widthForTrack],
  );

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (!event.altKey && !event.ctrlKey) return;
    event.preventDefault();
    const pointer = resolvePointerDepth(event.clientY);
    zoomAtDepth(pointer.depth, event.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR, pointer.viewportBodyY);
  };

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTo(event.currentTarget.scrollTop);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(BOREHOLE_EXPLORER_DRAG_MIME_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    const rawPayload = event.dataTransfer.getData(BOREHOLE_EXPLORER_DRAG_MIME_TYPE);
    if (!rawPayload) return;
    event.preventDefault();
    try {
      const payload = JSON.parse(rawPayload);
      const result = resolveLogWidgetDrop({ ...sourceWidget, tracks }, payload, data);
      setDropMessage(result.message);
      if (result.status === "changed") {
        setRuntimeTracks(result.widget.tracks ?? []);
      }
    } catch {
      setDropMessage("Dropped explorer item could not be applied.");
    }
  };

  const setScrollRef = useCallback((element: HTMLDivElement | null) => {
    scrollRef.current = element;
    setScrollElement(element);
  }, []);

  const selectedDepthY = selectedDepth === null ? null : viewport.scale.depthToY(selectedDepth);
  const domainSpan = depthSpanSize(depthDomain);
  const rulerLabel = ruler ? `${ruler.depth.toFixed(2)} m` : "";
  const diagnostics = useMemo(
    () => buildLogWidgetControlPlaneDiagnostics(controlPlane.invariantSnapshot()),
    [controlPlane],
  );

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
        ref={setScrollRef}
        onScroll={handleScroll}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className="track-row"
          style={{ height: viewport.contentHeight }}
          onMouseLeave={() => {
            setRuler(null);
            setHoveredObject(null);
            setDragSelectionState(null);
          }}
        >
          {visibleTracks.map((track) => renderRegisteredTrack(data, track, trackContext))}
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
                zoomAtDepth(contextMenu.depth, ZOOM_IN_FACTOR);
                setContextMenu(null);
              }}
              onZoomOut={() => {
                zoomAtDepth(contextMenu.depth, ZOOM_OUT_FACTOR);
                setContextMenu(null);
              }}
              onFullDepth={() => {
                resetFullDepth();
                setContextMenu(null);
              }}
              onToggleTooltips={() => {
                setTooltipsEnabled(!tooltipsEnabled);
                setContextMenu(null);
              }}
              diagnosticsVisible={diagnosticsVisible}
              onToggleDiagnostics={() => {
                setDiagnosticsVisible((visible) => !visible);
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
        diagnosticsVisible={diagnosticsVisible}
        diagnostics={diagnostics}
        onZoomIn={() => zoomAtDepth(selectedDepth ?? midpoint(viewport.visibleDepthSpan), ZOOM_IN_FACTOR)}
        onZoomOut={() => zoomAtDepth(selectedDepth ?? midpoint(viewport.visibleDepthSpan), ZOOM_OUT_FACTOR)}
        onFullDepth={resetFullDepth}
        onToggleTooltips={() => setTooltipsEnabled(!tooltipsEnabled)}
        onToggleDiagnostics={() => setDiagnosticsVisible((visible) => !visible)}
      />
      {dropMessage && (
        <div className="log-widget-drop-message">
          <span>{dropMessage}</span>
          {runtimeTracks && <b>Temporary</b>}
          <button type="button" onClick={() => setDropMessage(null)}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function midpoint(span: { fromDepth: number; toDepth: number }) {
  return (span.fromDepth + span.toDepth) / 2;
}
