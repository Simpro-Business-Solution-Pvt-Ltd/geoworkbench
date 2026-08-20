import type { Curve, DisplayTrack } from "../../../api/types";
import { curveFamilyLabel, curveMappingStatus, curveMnemonic } from "../../data/curveDictionary";
import { defaultScaleForCurve } from "../displayEditorModel";

type Props = {
  track: DisplayTrack;
  availableCurves: Curve[];
  patchTrack: (patch: Partial<DisplayTrack>) => void;
};

export function CurveTrackSettings({ track, availableCurves, patchTrack }: Props) {
  const missingCurves = availableCurves.filter((curve) => !track.curves?.some((item) => item.curveKey === curve.key));

  return (
    <div className="curve-settings-list">
      <strong>Curves From Geophysical Logs</strong>
      <div className="catalog-actions">
        {missingCurves.map((curve) => (
          <button
            key={curve.key}
            type="button"
            onClick={() =>
              patchTrack({
                curves: [
                  ...(track.curves ?? []),
                  {
                    curveKey: curve.key,
                    label: curve.label,
                    unit: curve.unit,
                    color: curve.color,
                    visible: true,
                    tooltipEnabled: true,
                    lineStyle: "solid",
                    scale: defaultScaleForCurve(curve),
                  },
                ],
              })
            }
          >
            Add {curve.label}
          </button>
        ))}
      </div>
      {track.curves?.map((curve) => (
        <div key={curve.curveKey} className="curve-editor">
          {(() => {
            const sourceCurve = availableCurves.find((item) => item.key === curve.curveKey);
            return sourceCurve ? (
              <small>
                {curveMnemonic(sourceCurve)} · {curveFamilyLabel(sourceCurve)} · {curveMappingStatus(sourceCurve)}
              </small>
            ) : null;
          })()}
          <label>
            <input
              type="checkbox"
              checked={curve.visible}
              onChange={(event) =>
                patchTrack({
                  curves: track.curves?.map((item) =>
                    item.curveKey === curve.curveKey ? { ...item, visible: event.target.checked } : item,
                  ),
                })
              }
            />
            <span style={{ color: curve.color }}>{curve.label}</span>
          </label>
          <div className="curve-scale-grid">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={curve.tooltipEnabled !== false}
                onChange={(event) =>
                  patchTrack({
                    curves: track.curves?.map((item) =>
                      item.curveKey === curve.curveKey ? { ...item, tooltipEnabled: event.target.checked } : item,
                    ),
                  })
                }
              />
              Tooltip
            </label>
            <label>
              Line
              <select
                value={curve.lineStyle ?? "solid"}
                onChange={(event) =>
                  patchTrack({
                    curves: track.curves?.map((item) =>
                      item.curveKey === curve.curveKey ? { ...item, lineStyle: event.target.value } : item,
                    ),
                  })
                }
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
                  patchTrack({
                    curves: track.curves?.map((item) =>
                      item.curveKey === curve.curveKey
                        ? { ...item, scale: { ...item.scale, min: Number(event.target.value), mode: "manual" } }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              Max
              <input
                type="number"
                value={curve.scale.max}
                onChange={(event) =>
                  patchTrack({
                    curves: track.curves?.map((item) =>
                      item.curveKey === curve.curveKey
                        ? { ...item, scale: { ...item.scale, max: Number(event.target.value), mode: "manual" } }
                        : item,
                    ),
                  })
                }
              />
            </label>
            <label>
              Color
              <input
                type="color"
                value={curve.color}
                onChange={(event) =>
                  patchTrack({
                    curves: track.curves?.map((item) =>
                      item.curveKey === curve.curveKey ? { ...item, color: event.target.value } : item,
                    ),
                  })
                }
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => patchTrack({ curves: track.curves?.filter((item) => item.curveKey !== curve.curveKey) })}
          >
            Remove curve
          </button>
        </div>
      ))}
    </div>
  );
}
