import { ArrowDown, ArrowUp, Plus, RotateCcw, Trash2 } from "lucide-react";

import type { Curve, DisplayTrack } from "../../../api/types";
import { curveFamilyLabel, curveMappingStatus, curveMnemonic } from "../../data/curveDictionary";
import { defaultScaleForCurve } from "../trackCatalog";
import { moveItem } from "./displayGridUtils";

type Props = {
  track: DisplayTrack;
  availableCurves: Curve[];
  selectedCurveKey: string | null;
  patchTrack: (patch: Partial<DisplayTrack>) => void;
  onSelectCurve: (curveKey: string | null) => void;
  onOpenCurveDictionary: () => void;
};

export function CurveTrackSettings({
  track,
  availableCurves,
  selectedCurveKey,
  patchTrack,
  onSelectCurve,
  onOpenCurveDictionary,
}: Props) {
  const configuredCurves = track.curves ?? [];
  const selectedCurve = configuredCurves.find((curve) => curve.curveKey === selectedCurveKey) ?? null;
  const selectedCurveIndex = selectedCurve ? configuredCurves.findIndex((curve) => curve.curveKey === selectedCurve.curveKey) : -1;
  const missingCurves = availableCurves.filter((curve) => !configuredCurves.some((item) => item.curveKey === curve.key));

  return (
    <div className="curve-settings-list">
      <div className="curve-settings-header">
        <div>
          <strong>Curve Track</strong>
          <span>
            {configuredCurves.length} configured · {missingCurves.length} available
          </span>
        </div>
        <button type="button" className="log-action-button" onClick={onOpenCurveDictionary}>
          <Plus size={14} />
          Add curve
        </button>
      </div>

      <div className="selected-curve-settings">
        <div className="selected-curve-head">
          <span>{selectedCurve ? "Selected curve settings" : "Select a curve from the Log Structure tree"}</span>
          {!selectedCurve && (
            <button type="button" className="log-action-button" onClick={onOpenCurveDictionary}>
              <Plus size={14} />
              Add curve
            </button>
          )}
        </div>
        {selectedCurve ? (
          <CurveEditor
            curve={selectedCurve}
            index={selectedCurveIndex}
            curves={configuredCurves}
            availableCurves={availableCurves}
            patchTrack={patchTrack}
            onSelectCurve={onSelectCurve}
          />
        ) : (
          <div className="empty">
            No curve selected. Use the tree on the left to edit a configured curve, or add a new curve from the dictionary.
          </div>
        )}
      </div>
      {!missingCurves.length && <small>All available curves are already configured on this track.</small>}
    </div>
  );
}

function CurveEditor({
  curve,
  index,
  curves,
  availableCurves,
  patchTrack,
  onSelectCurve,
}: {
  curve: NonNullable<DisplayTrack["curves"]>[number];
  index: number;
  curves: NonNullable<DisplayTrack["curves"]>;
  availableCurves: Curve[];
  patchTrack: (patch: Partial<DisplayTrack>) => void;
  onSelectCurve: (curveKey: string | null) => void;
}) {
  const sourceCurve = availableCurves.find((item) => item.key === curve.curveKey);
  const patchCurve = (updater: (item: typeof curve) => typeof curve) => {
    patchTrack({
      curves: curves.map((item) => (item.curveKey === curve.curveKey ? updater(item) : item)),
    });
  };

  return (
    <div className="curve-editor">
      <div className="curve-editor-titlebar">
        <div>
          <small>
            {sourceCurve
              ? `${curveMnemonic(sourceCurve)} · ${curveFamilyLabel(sourceCurve)} · ${curveMappingStatus(sourceCurve)}`
              : `${curve.curveKey} · source curve missing from current borehole payload`}
          </small>
          <strong style={{ color: curve.color }}>{curve.label}</strong>
        </div>
        <label className="curve-visible-toggle">
          <input
            type="checkbox"
            checked={curve.visible}
            onChange={(event) => patchCurve((item) => ({ ...item, visible: event.target.checked }))}
          />
          Visible
        </label>
      </div>
      <div className="curve-scale-grid">
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={curve.tooltipEnabled !== false}
            onChange={(event) => patchCurve((item) => ({ ...item, tooltipEnabled: event.target.checked }))}
          />
          Tooltip
        </label>
        <label>
          Line
          <select
            value={curve.lineStyle ?? "solid"}
            onChange={(event) => patchCurve((item) => ({ ...item, lineStyle: event.target.value }))}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </label>
        <label>
          Min
          <input
            type="number"
            value={curve.scale.min}
            onChange={(event) =>
              patchCurve((item) => ({ ...item, scale: { ...item.scale, min: Number(event.target.value), mode: "manual" } }))
            }
          />
        </label>
        <label>
          Max
          <input
            type="number"
            value={curve.scale.max}
            onChange={(event) =>
              patchCurve((item) => ({ ...item, scale: { ...item.scale, max: Number(event.target.value), mode: "manual" } }))
            }
          />
        </label>
        <label>
          Color
          <span className="curve-color-field">
            <input
              type="color"
              value={curve.color}
              onChange={(event) => patchCurve((item) => ({ ...item, color: event.target.value }))}
            />
            <span>{curve.color.toUpperCase()}</span>
          </span>
        </label>
      </div>
      <div className="curve-editor-actions">
        <button
          type="button"
          className="danger-action"
          onClick={() => {
            const fallbackCurve = curves[index + 1] ?? curves[index - 1] ?? null;
            patchTrack({ curves: curves.filter((item) => item.curveKey !== curve.curveKey) });
            onSelectCurve(fallbackCurve?.curveKey ?? null);
          }}
        >
          <Trash2 size={13} />
          Delete curve
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => patchTrack({ curves: moveItem(curves, index, index - 1) })}
        >
          <ArrowUp size={13} />
          Move up
        </button>
        <button
          type="button"
          disabled={index === curves.length - 1}
          onClick={() => patchTrack({ curves: moveItem(curves, index, index + 1) })}
        >
          <ArrowDown size={13} />
          Move down
        </button>
        <button
          type="button"
          disabled={!sourceCurve}
          onClick={() => {
            if (!sourceCurve) return;
            patchCurve((item) => ({ ...item, scale: defaultScaleForCurve(sourceCurve) }));
          }}
        >
          <RotateCcw size={13} />
          Reset scale
        </button>
      </div>
    </div>
  );
}
