import { useEffect, useMemo, useState } from "react";

import type { Curve, DisplayTrack } from "../../../api/types";
import { curveFamilyLabel, curveMappingStatus, curveMnemonic } from "../../data/curveDictionary";
import { createCurveDisplayConfig, defaultScaleForCurve } from "../trackCatalog";
import { moveItem } from "./displayGridUtils";

type Props = {
  track: DisplayTrack;
  availableCurves: Curve[];
  patchTrack: (patch: Partial<DisplayTrack>) => void;
};

export function CurveTrackSettings({ track, availableCurves, patchTrack }: Props) {
  const [curveSearch, setCurveSearch] = useState("");
  const [selectedCurveKey, setSelectedCurveKey] = useState<string | null>(null);
  const configuredCurves = track.curves ?? [];
  const selectedCurve = configuredCurves.find((curve) => curve.curveKey === selectedCurveKey) ?? configuredCurves[0] ?? null;
  const selectedCurveIndex = selectedCurve ? configuredCurves.findIndex((curve) => curve.curveKey === selectedCurve.curveKey) : -1;
  const missingCurves = availableCurves.filter((curve) => !track.curves?.some((item) => item.curveKey === curve.key));
  const filteredMissingCurves = useMemo(() => {
    const query = curveSearch.trim().toLowerCase();
    if (!query) return missingCurves;
    return missingCurves.filter((curve) =>
      [curve.key, curve.label, curve.unit, curveFamilyLabel(curve), curveMappingStatus(curve)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [curveSearch, missingCurves]);
  const groupedMissingCurves = useMemo(
    () =>
      filteredMissingCurves.reduce<Record<string, Curve[]>>((groups, curve) => {
        const group = curveFamilyLabel(curve);
        groups[group] = [...(groups[group] ?? []), curve];
        return groups;
      }, {}),
    [filteredMissingCurves],
  );
  const sampleSource = track.renderer?.sampleSource === "visible-window" ? "visible-window" : "workbench";
  const maxWindowSamples = typeof track.renderer?.maxWindowSamples === "number" ? track.renderer.maxWindowSamples : "";
  const configuredCurveCount = configuredCurves.length;

  useEffect(() => {
    if (!configuredCurves.length) {
      setSelectedCurveKey(null);
      return;
    }
    if (!selectedCurveKey || !configuredCurves.some((curve) => curve.curveKey === selectedCurveKey)) {
      setSelectedCurveKey(configuredCurves[0].curveKey);
    }
  }, [configuredCurves, selectedCurveKey]);

  return (
    <div className="curve-settings-list">
      <strong>Curves From Geophysical Logs</strong>
      <div className="curve-scale-grid">
        <label>
          Data source
          <select
            value={sampleSource}
            onChange={(event) =>
              patchTrack({
                renderer: {
                  ...(track.renderer ?? {}),
                  sampleSource: event.target.value === "visible-window" ? "visible-window" : "workbench",
                },
              })
            }
          >
            <option value="workbench">Workbench payload</option>
            <option value="visible-window">Visible depth window</option>
          </select>
        </label>
        <label>
          Max window samples
          <input
            type="number"
            min="50"
            step="50"
            value={maxWindowSamples}
            placeholder="All"
            disabled={sampleSource !== "visible-window"}
            onChange={(event) =>
              patchTrack({
                renderer: {
                  ...(track.renderer ?? {}),
                  maxWindowSamples: event.target.value ? Number(event.target.value) : undefined,
                },
              })
            }
          />
        </label>
      </div>
      <div className="curve-picker">
        <div className="curve-picker-head">
          <span>
            {configuredCurveCount} configured · {missingCurves.length} available to add
          </span>
          <input
            value={curveSearch}
            placeholder="Find curve"
            onChange={(event) => setCurveSearch(event.target.value)}
          />
        </div>
        {Object.entries(groupedMissingCurves).map(([family, curves]) => (
          <section key={family} className="curve-picker-group">
            <strong>{family}</strong>
            <div className="curve-picker-items">
              {curves.map((curve) => (
                <button
                  key={curve.key}
                  type="button"
                  title={`${curve.key} · ${curve.unit || "unitless"} · ${curveMappingStatus(curve)}`}
                  onClick={() =>
                    patchTrack({
                      curves: [...(track.curves ?? []), createCurveDisplayConfig(curve)],
                    })
                  }
                >
                  <i style={{ backgroundColor: curve.color }} />
                  <span>{curveMnemonic(curve)}</span>
                  <small>{curve.unit || "-"}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {!missingCurves.length && <small>All available curves are already configured on this track.</small>}
      {Boolean(missingCurves.length) && !filteredMissingCurves.length && <small>No curves match the current filter.</small>}
      <div className="configured-curve-manager">
        <div className="configured-curve-list">
          {configuredCurves.map((curve) => (
            <button
              key={curve.curveKey}
              type="button"
              className={selectedCurve?.curveKey === curve.curveKey ? "selected" : ""}
              onClick={() => setSelectedCurveKey(curve.curveKey)}
            >
              <i style={{ backgroundColor: curve.color }} />
              <span>{curve.label}</span>
              <small>{curve.unit || "-"}</small>
              {!curve.visible && <b>Hidden</b>}
            </button>
          ))}
          {!configuredCurves.length && <div className="empty">No curves configured on this track.</div>}
        </div>

        {selectedCurve && (
          <CurveEditor
            curve={selectedCurve}
            index={selectedCurveIndex}
            curves={configuredCurves}
            availableCurves={availableCurves}
            patchTrack={patchTrack}
            onSelectCurve={setSelectedCurveKey}
          />
        )}
      </div>
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
      {sourceCurve ? (
        <small>
          {curveMnemonic(sourceCurve)} · {curveFamilyLabel(sourceCurve)} · {curveMappingStatus(sourceCurve)}
        </small>
      ) : (
        <small>{curve.curveKey} · source curve missing from current borehole payload</small>
      )}
      <label>
        <input
          type="checkbox"
          checked={curve.visible}
          onChange={(event) => patchCurve((item) => ({ ...item, visible: event.target.checked }))}
        />
        <span style={{ color: curve.color }}>{curve.label}</span>
      </label>
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
          <input
            type="color"
            value={curve.color}
            onChange={(event) => patchCurve((item) => ({ ...item, color: event.target.value }))}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => {
          const fallbackCurve = curves[index + 1] ?? curves[index - 1] ?? null;
          patchTrack({ curves: curves.filter((item) => item.curveKey !== curve.curveKey) });
          onSelectCurve(fallbackCurve?.curveKey ?? null);
        }}
      >
        Remove curve
      </button>
      <div className="curve-action-row">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => patchTrack({ curves: moveItem(curves, index, index - 1) })}
        >
          Move up
        </button>
        <button
          type="button"
          disabled={index === curves.length - 1}
          onClick={() => patchTrack({ curves: moveItem(curves, index, index + 1) })}
        >
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
          Reset scale
        </button>
      </div>
    </div>
  );
}
