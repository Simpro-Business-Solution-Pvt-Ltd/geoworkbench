import { useMemo } from "react";

import type { BoreholeWorkbench, DisplayTrack } from "../../../api/types";
import type { LogTrackContext } from "../../core/logTrackContext";
import { numericRendererSetting } from "../../core/rendererSettings";
import { TrackFrame } from "../../core/TrackFrame";
import { useWorkbenchStore } from "../../display/workbenchStore";
import { buildCurveSampleHit, curveHitBelongsToTrack } from "./curveHitTestModel";
import { buildCurveRenderModels, strokeDasharray } from "./curveRenderModel";
import { useCurveWindowData } from "./useCurveWindowData";

type Props = {
  data: BoreholeWorkbench;
  track: DisplayTrack;
  context: LogTrackContext;
};

export function CurveTrack({ data, track, context }: Props) {
  const { scale } = context;
  const { hoveredObject, tooltipsEnabled } = useWorkbenchStore();
  const { configuredCurves, curves } = useCurveWindowData({
    data,
    track,
    visibleDepthSpan: context.visibleDepthSpan,
  });
  const renderModels = useMemo(
    () =>
      buildCurveRenderModels(curves, scale, {
        minYPixelSpacing: numericRendererSetting(track, "minYPixelSpacing", 1.5),
      }),
    [curves, scale, track],
  );
  const hit = curveHitBelongsToTrack(hoveredObject, curves) ? hoveredObject : null;

  return (
    <TrackFrame
      data={data}
      track={track}
      context={context}
      className="curve-track"
      headerDetail={
        <div className="curve-header-stack">
          {configuredCurves.map((curve) => (
            <div key={curve.curveKey} className="curve-header-row">
              <span className="curve-header-min">{formatScaleValue(curve.scale.min)}</span>
              <span className="curve-header-line">
                <i style={{ background: curve.color }} />
                <b style={{ color: curve.color }}>{curve.label}</b>
                <small>{curve.unit}</small>
              </span>
              <span className="curve-header-max">{formatScaleValue(curve.scale.max)}</span>
            </div>
          ))}
        </div>
      }
      hitTest={({ depth }) => buildCurveSampleHit(curves, scale, depth)}
    >
      <svg className="curve-svg" preserveAspectRatio="none" viewBox="0 0 100 100">
        {renderModels.map((model) => {
          return (
            <polyline
              key={model.curveKey}
              points={model.polylinePoints}
              fill="none"
              stroke={model.color}
              strokeWidth="0.8"
              strokeDasharray={strokeDasharray(model.lineStyle)}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      {tooltipsEnabled && track.interaction?.tooltipEnabled !== false && hit && (
        <div
          className="curve-tooltip multi"
          style={{ left: `${hit.screenXPercent}%`, top: `${hit.screenYPercent}%` }}
        >
          <b>{hit.sample.depth.toFixed(2)} m</b>
          {(hit.relatedSamples ?? [hit])
            .filter((item) => configuredCurves.find((config) => config.curveKey === item.curve.key)?.tooltipEnabled !== false)
            .map((item) => (
              <span key={item.curve.key} className={item.curve.key === hit.curve.key ? "nearest" : ""}>
                <i style={{ background: item.curve.color }} />
                {item.curve.label}: {item.sample.value} {item.curve.unit}
              </span>
            ))}
          <small>
            nearest {hit.curve.label} · delta {hit.distance.toFixed(2)} m · {hit.curve.source_type}
          </small>
        </div>
      )}
    </TrackFrame>
  );
}

function formatScaleValue(value: number) {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, "");
  return value.toFixed(2).replace(/\.?0+$/, "");
}
