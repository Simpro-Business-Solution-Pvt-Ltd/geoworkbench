import { useEffect, useState } from "react";

import type { Curve, DisplayLayout, DisplayTrack } from "../../api/types";
import { defaultScaleForCurve, TRACK_CATALOG } from "./trackCatalog";

type Props = {
  layout: DisplayLayout | null;
  availableCurves: Curve[];
  saving: boolean;
  resetting: boolean;
  onSave: (layout: DisplayLayout) => void;
  onReset: () => void;
};

function cloneLayout(layout: DisplayLayout): DisplayLayout {
  return structuredClone(layout);
}

function updateTracks(
  layout: DisplayLayout,
  updater: (tracks: DisplayTrack[]) => DisplayTrack[],
): DisplayLayout {
  const next = cloneLayout(layout);
  const widget = next.settings.widgets?.["log-widget"];
  if (!widget?.tracks) return next;
  widget.tracks = updater(widget.tracks);
  return next;
}

function moveTrack(tracks: DisplayTrack[], index: number, target: number) {
  const next = [...tracks];
  if (target < 0 || target >= next.length || target === index) return next;
  const [track] = next.splice(index, 1);
  next.splice(target, 0, track);
  return next;
}

function curveIsConfigured(track: DisplayTrack, curveKey: string) {
  return Boolean(track.curves?.some((curve) => curve.curveKey === curveKey));
}

export function DisplaySettingsPanel({
  layout,
  availableCurves,
  saving,
  resetting,
  onSave,
  onReset,
}: Props) {
  const [draft, setDraft] = useState<DisplayLayout | null>(layout);
  const [dragTrackId, setDragTrackId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(layout);
  }, [layout]);

  if (!layout) {
    return <div className="settings-note">No saved layout is available for this borehole.</div>;
  }

  const activeLayout = draft ?? layout;
  const tracks = activeLayout.settings.widgets?.["log-widget"]?.tracks ?? [];
  const missingTracks = TRACK_CATALOG.filter((item) => !tracks.some((track) => track.id === item.id));
  const curveTrack = tracks.find((track) => track.type === "curve");
  const missingCurves = curveTrack
    ? availableCurves.filter((curve) => !curveIsConfigured(curveTrack, curve.key))
    : [];
  const updateDraftTracks = (updater: (tracks: DisplayTrack[]) => DisplayTrack[]) => {
    setDraft(updateTracks(activeLayout, updater));
  };

  return (
    <div className="display-editor">
      <div className="settings-note">
        Edit mode changes are saved into this borehole layout JSON. Widths are relative; visible
        tracks automatically fill the log area.
      </div>
      <div className="display-editor-actions">
        <button type="button" disabled={saving || !draft} onClick={() => draft && onSave(draft)}>
          {saving ? "Saving..." : "Save layout"}
        </button>
        <button type="button" disabled={resetting} onClick={onReset}>
          {resetting ? "Resetting..." : "Reset default"}
        </button>
      </div>

      {(missingTracks.length > 0 || missingCurves.length > 0) && (
        <section className="track-editor">
          <strong>Add To Display</strong>
          <div className="catalog-actions">
            {missingTracks.map((item) => (
              <button
                key={item.id}
                type="button"
                title={`${item.category}: ${item.description}`}
                onClick={() => updateDraftTracks((items) => [...items, item.create(availableCurves)])}
              >
                {item.label}
              </button>
            ))}
            {curveTrack &&
              missingCurves.map((curve) => (
                <button
                  key={curve.key}
                  type="button"
                  onClick={() =>
                    updateDraftTracks((items) =>
                      items.map((item) =>
                        item.id === curveTrack.id
                          ? {
                              ...item,
                              curves: [
                                ...(item.curves ?? []),
                                {
                                  curveKey: curve.key,
                                  label: curve.label,
                                  unit: curve.unit,
                                  color: curve.color,
                                  visible: true,
                                  scale: defaultScaleForCurve(curve),
                                },
                              ],
                            }
                          : item,
                      ),
                    )
                  }
                >
                  {curve.label} curve
                </button>
              ))}
          </div>
        </section>
      )}

      {tracks.map((track, index) => (
        <section
          key={track.id}
          className="track-editor"
          draggable
          onDragStart={() => setDragTrackId(track.id)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            const fromIndex = tracks.findIndex((item) => item.id === dragTrackId);
            if (fromIndex >= 0) {
              updateDraftTracks((items) => moveTrack(items, fromIndex, index));
            }
            setDragTrackId(null);
          }}
        >
          <div className="track-editor-head">
            <label>
              <input
                type="checkbox"
                checked={track.visible}
                onChange={(event) =>
                  updateDraftTracks((items) =>
                    items.map((item) =>
                      item.id === track.id ? { ...item, visible: event.target.checked } : item,
                    ),
                  )
                }
              />
              <span>{track.title}</span>
            </label>
            <div>
              <button
                type="button"
                disabled={index === 0 || saving}
                onClick={() => updateDraftTracks((items) => moveTrack(items, index, index - 1))}
              >
                Up
              </button>
              <button
                type="button"
                disabled={index === tracks.length - 1 || saving}
                onClick={() => updateDraftTracks((items) => moveTrack(items, index, index + 1))}
              >
                Down
              </button>
              <button
                type="button"
                disabled={tracks.length <= 1 || saving}
                onClick={() => updateDraftTracks((items) => items.filter((item) => item.id !== track.id))}
              >
                Remove
              </button>
            </div>
          </div>
          <label className="range-control">
            <span>Width {track.width}</span>
            <input
              type="range"
              min="50"
              max="420"
              value={track.width}
              onChange={(event) =>
                updateDraftTracks((items) =>
                  items.map((item) =>
                    item.id === track.id ? { ...item, width: Number(event.target.value) } : item,
                  ),
                )
              }
            />
          </label>

          {track.type === "curve" &&
            track.curves?.map((curve) => (
              <div key={curve.curveKey} className="curve-editor">
                <label>
                  <input
                    type="checkbox"
                    checked={curve.visible}
                    onChange={(event) =>
                      updateDraftTracks((items) =>
                        items.map((item) =>
                          item.id === track.id
                            ? {
                                ...item,
                                curves: item.curves?.map((candidate) =>
                                  candidate.curveKey === curve.curveKey
                                    ? { ...candidate, visible: event.target.checked }
                                    : candidate,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                  <span style={{ color: curve.color }}>{curve.label}</span>
                </label>
                <div className="curve-scale-grid">
                  <label>
                    Min
                    <input
                      type="number"
                      value={curve.scale.min}
                      onChange={(event) =>
                        updateDraftTracks((items) =>
                          items.map((item) =>
                            item.id === track.id
                              ? {
                                  ...item,
                                  curves: item.curves?.map((candidate) =>
                                    candidate.curveKey === curve.curveKey
                                      ? {
                                          ...candidate,
                                          scale: {
                                            ...candidate.scale,
                                            min: Number(event.target.value),
                                            mode: "manual",
                                          },
                                        }
                                      : candidate,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Max
                    <input
                      type="number"
                      value={curve.scale.max}
                      onChange={(event) =>
                        updateDraftTracks((items) =>
                          items.map((item) =>
                            item.id === track.id
                              ? {
                                  ...item,
                                  curves: item.curves?.map((candidate) =>
                                    candidate.curveKey === curve.curveKey
                                      ? {
                                          ...candidate,
                                          scale: {
                                            ...candidate.scale,
                                            max: Number(event.target.value),
                                            mode: "manual",
                                          },
                                        }
                                      : candidate,
                                  ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    updateDraftTracks((items) =>
                      items.map((item) =>
                        item.id === track.id
                          ? {
                              ...item,
                              curves: item.curves?.filter(
                                (candidate) => candidate.curveKey !== curve.curveKey,
                              ),
                            }
                          : item,
                      ),
                    )
                  }
                >
                  Remove curve
                </button>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}
