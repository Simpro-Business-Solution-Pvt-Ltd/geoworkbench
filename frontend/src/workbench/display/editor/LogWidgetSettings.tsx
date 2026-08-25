import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Copy, Plus, Settings2, Trash2, X } from "lucide-react";

import type { Curve, DisplayTrack, DisplayWidget } from "../../../api/types";
import { curveFamilyLabel, curveMappingStatus, curveMnemonic } from "../../data/curveDictionary";
import {
  addCatalogTrackToLogWidget,
  cloneLogWidgetTrack,
  moveLogWidgetTrack,
  patchLogWidgetTrack,
  removeLogWidgetTrack,
} from "../logWidgetConfigModel";
import { createCurveDisplayConfig, TRACK_CATALOG } from "../trackCatalog";
import { CurveTrackSettings } from "./CurveTrackSettings";
import { QuantitativeTrackSettings } from "./QuantitativeTrackSettings";
import { RemarksTrackSettings } from "./RemarksTrackSettings";
import { SeamTrackSettings } from "./SeamTrackSettings";

type Props = {
  widget: DisplayWidget;
  availableCurves: Curve[];
  onUpdateWidget: (updater: (widget: DisplayWidget) => DisplayWidget) => void;
};

type DictionaryMode = { kind: "track" } | { kind: "curve"; trackId: string } | null;

export function LogWidgetSettings({ widget, availableCurves, onUpdateWidget }: Props) {
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedCurveKey, setSelectedCurveKey] = useState<string | null>(null);
  const [dictionaryMode, setDictionaryMode] = useState<DictionaryMode>(null);
  const [collapsedTrackIds, setCollapsedTrackIds] = useState<Set<string>>(new Set());
  const tracks = widget.tracks ?? [];
  const selectedTrack = tracks.find((track) => track.id === selectedTrackId) ?? tracks[0] ?? null;
  const selectedTrackIndex = selectedTrack ? tracks.findIndex((track) => track.id === selectedTrack.id) : -1;

  useEffect(() => {
    if (!tracks.length) {
      setSelectedTrackId(null);
      setSelectedCurveKey(null);
      return;
    }
    if (!selectedTrackId || !tracks.some((track) => track.id === selectedTrackId)) {
      setSelectedTrackId(tracks[0].id);
      setSelectedCurveKey(null);
    }
    setCollapsedTrackIds((current) => new Set([...current].filter((trackId) => tracks.some((track) => track.id === trackId))));
  }, [selectedTrackId, tracks]);

  useEffect(() => {
    if (!selectedTrack || selectedTrack.type !== "curve") {
      setSelectedCurveKey(null);
      return;
    }
    if (selectedCurveKey && !selectedTrack.curves?.some((curve) => curve.curveKey === selectedCurveKey)) {
      setSelectedCurveKey(null);
    }
  }, [selectedCurveKey, selectedTrack]);

  const updateTracks = (updater: (tracks: DisplayTrack[]) => DisplayTrack[]) => {
    onUpdateWidget((item) => ({ ...item, tracks: updater(item.tracks ?? []) }));
  };

  const deleteTrack = (trackId: string) => {
    const index = tracks.findIndex((track) => track.id === trackId);
    const fallbackTrack = tracks[index + 1] ?? tracks[index - 1] ?? null;
    updateTracks((items) =>
      removeLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, trackId).widget.tracks ?? items,
    );
    setSelectedTrackId(fallbackTrack?.id ?? null);
    setSelectedCurveKey(null);
    setDictionaryMode(null);
  };

  const deleteCurve = (track: DisplayTrack, curveKey: string) => {
    const curves = track.curves ?? [];
    const curveIndex = curves.findIndex((curve) => curve.curveKey === curveKey);
    const fallbackCurve = curves[curveIndex + 1] ?? curves[curveIndex - 1] ?? null;
    updateTracks((items) =>
      items.map((item) =>
        item.id === track.id ? { ...item, curves: curves.filter((curve) => curve.curveKey !== curveKey) } : item,
      ),
    );
    setSelectedTrackId(track.id);
    setSelectedCurveKey(fallbackCurve?.curveKey ?? null);
    setDictionaryMode(null);
  };

  return (
    <div className="log-widget-settings">
      <div className="log-widget-track-manager">
        <aside className="log-widget-track-list">
          <section className="log-structure-panel">
            <div className="log-structure-head">
              <div>
                <strong>Log Structure</strong>
                <span>{tracks.length} tracks</span>
              </div>
              <button
                className="log-action-button"
                type="button"
                onClick={() => {
                  setDictionaryMode({ kind: "track" });
                  setSelectedCurveKey(null);
                }}
              >
                <Plus size={14} />
                Add track
              </button>
            </div>
            <div className="log-track-tree">
              {tracks.map((track, index) => (
                <TrackTreeNode
                  key={track.id}
                  index={index}
                  track={track}
                  selectedTrackId={selectedTrack?.id ?? null}
                  selectedCurveKey={selectedCurveKey}
                  canDelete={tracks.length > 1}
                  collapsed={collapsedTrackIds.has(track.id)}
                  onSelectTrack={(trackId) => {
                    setSelectedTrackId(trackId);
                    setSelectedCurveKey(null);
                    setDictionaryMode(null);
                  }}
                  onToggleCollapse={() =>
                    setCollapsedTrackIds((current) => {
                      const next = new Set(current);
                      if (next.has(track.id)) next.delete(track.id);
                      else next.add(track.id);
                      return next;
                    })
                  }
                  onSelectCurve={(curveKey) => {
                    setSelectedTrackId(track.id);
                    setSelectedCurveKey(curveKey);
                    setDictionaryMode(null);
                  }}
                  onAddCurve={() => {
                    setSelectedTrackId(track.id);
                    setSelectedCurveKey(null);
                    setDictionaryMode({ kind: "curve", trackId: track.id });
                  }}
                  onDeleteTrack={() => deleteTrack(track.id)}
                  onDeleteCurve={(curveKey) => deleteCurve(track, curveKey)}
                />
              ))}
              {!tracks.length && <div className="empty">No tracks configured.</div>}
            </div>
          </section>
        </aside>

        <div className="log-widget-track-detail">
          {dictionaryMode?.kind === "track" ? (
            <TrackDictionary
              availableCurves={availableCurves}
              onClose={() => setDictionaryMode(null)}
              onAddTrack={(catalogId) => {
                let nextTrackId: string | undefined;
                onUpdateWidget((current) => {
                  const result = addCatalogTrackToLogWidget(current, catalogId, availableCurves);
                  nextTrackId = result.trackId;
                  return result.widget;
                });
                if (nextTrackId) setSelectedTrackId(nextTrackId);
                setSelectedCurveKey(null);
                setDictionaryMode(null);
              }}
            />
          ) : dictionaryMode?.kind === "curve" && selectedTrack?.type === "curve" ? (
            <CurveDictionary
              track={selectedTrack}
              availableCurves={availableCurves}
              onClose={() => setDictionaryMode(null)}
              onAddCurve={(curve) => {
                updateTracks((items) =>
                  items.map((item) =>
                    item.id === selectedTrack.id
                      ? { ...item, curves: [...(item.curves ?? []), createCurveDisplayConfig(curve)] }
                      : item,
                  ),
                );
                setSelectedCurveKey(curve.key);
                setDictionaryMode(null);
              }}
            />
          ) : selectedTrack ? (
            <TrackSettings
              track={selectedTrack}
              index={selectedTrackIndex}
              tracks={tracks}
              availableCurves={availableCurves}
              selectedCurveKey={selectedCurveKey}
              onUpdateTracks={updateTracks}
              onSelectTrack={setSelectedTrackId}
              onSelectCurve={setSelectedCurveKey}
              onOpenCurveDictionary={() => {
                setSelectedCurveKey(null);
                setDictionaryMode({ kind: "curve", trackId: selectedTrack.id });
              }}
            />
          ) : (
            <div className="empty">Select or add a track to configure it.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackTreeNode({
  track,
  index,
  selectedTrackId,
  selectedCurveKey,
  canDelete,
  collapsed,
  onSelectTrack,
  onToggleCollapse,
  onSelectCurve,
  onAddCurve,
  onDeleteTrack,
  onDeleteCurve,
}: {
  track: DisplayTrack;
  index: number;
  selectedTrackId: string | null;
  selectedCurveKey: string | null;
  canDelete: boolean;
  collapsed: boolean;
  onSelectTrack: (trackId: string) => void;
  onToggleCollapse: () => void;
  onSelectCurve: (curveKey: string) => void;
  onAddCurve: () => void;
  onDeleteTrack: () => void;
  onDeleteCurve: (curveKey: string) => void;
}) {
  const curves = track.curves ?? [];
  return (
    <div className="log-track-tree-node">
      <div
        className={`log-track-row ${selectedTrackId === track.id && !selectedCurveKey ? "selected" : ""} ${
          !track.visible ? "muted" : ""
        }`}
      >
        <button type="button" className="log-track-main" onClick={() => onSelectTrack(track.id)}>
          <span>{index + 1}</span>
          <b>{track.title || track.type}</b>
          <small>
            {track.type}
            {track.type === "curve" ? ` · ${curves.filter((curve) => curve.visible).length}/${curves.length} curves` : ""}
          </small>
        </button>
        <div className="log-tree-actions">
          {track.type === "curve" && (
            <button
              type="button"
              className="log-icon-button"
              title={collapsed ? "Expand curves" : "Collapse curves"}
              aria-label={collapsed ? "Expand curves" : "Collapse curves"}
              onClick={onToggleCollapse}
            >
              {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
          {track.type === "curve" && (
            <button type="button" className="log-icon-button" title="Add curve" aria-label="Add curve" onClick={onAddCurve}>
              <Plus size={13} />
            </button>
          )}
          <button
            type="button"
            className="log-icon-button danger-action"
            title="Delete track"
            aria-label="Delete track"
            disabled={!canDelete}
            onClick={onDeleteTrack}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {track.type === "curve" && !collapsed && (
        <div className="log-track-object-tree">
          {curves.map((curve) => (
            <div key={curve.curveKey} className={`log-curve-row ${selectedCurveKey === curve.curveKey ? "selected" : ""}`}>
              <button type="button" className="log-curve-main" onClick={() => onSelectCurve(curve.curveKey)}>
                <i style={{ backgroundColor: curve.color }} />
                <span>{curve.label || curve.curveKey}</span>
                <small>{curve.unit || "-"}</small>
                {!curve.visible && <b>Hidden</b>}
              </button>
              <button
                type="button"
                className="log-icon-button danger-action"
                title="Delete curve"
                aria-label="Delete curve"
                onClick={() => onDeleteCurve(curve.curveKey)}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {!curves.length && <div className="log-tree-empty">No curves in this track.</div>}
        </div>
      )}
    </div>
  );
}

function TrackDictionary({
  availableCurves,
  onClose,
  onAddTrack,
}: {
  availableCurves: Curve[];
  onClose: () => void;
  onAddTrack: (catalogId: string) => void;
}) {
  const trackGroups = useMemo(
    () =>
      TRACK_CATALOG.reduce<Record<string, typeof TRACK_CATALOG>>((groups, item) => {
        groups[item.category] = [...(groups[item.category] ?? []), item];
        return groups;
      }, {}),
    [],
  );
  return (
    <section className="track-editor dictionary-panel">
      <div className="dictionary-head">
        <div>
          <strong>Track Dictionary</strong>
          <span>Choose the track type to add to this LogWidget.</span>
        </div>
        <button type="button" className="log-action-button" onClick={onClose}>
          <X size={14} />
          Close
        </button>
      </div>
      <div className="track-catalog-groups">
        {Object.entries(trackGroups).map(([category, group]) => (
          <div key={category} className="track-catalog-group">
            <span>{category}</span>
            <div className="catalog-actions">
              {group.map((item) => (
                <button key={item.id} type="button" title={item.description} onClick={() => onAddTrack(item.id)}>
                  {item.label}
                  {item.id === "curves" && availableCurves.length ? ` (${availableCurves.length})` : ""}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CurveDictionary({
  track,
  availableCurves,
  onClose,
  onAddCurve,
}: {
  track: DisplayTrack;
  availableCurves: Curve[];
  onClose: () => void;
  onAddCurve: (curve: Curve) => void;
}) {
  const [curveSearch, setCurveSearch] = useState("");
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

  return (
    <section className="track-editor dictionary-panel">
      <div className="dictionary-head">
        <div>
          <strong>Curve Dictionary</strong>
          <span>{missingCurves.length} curves available for {track.title || "this track"}.</span>
        </div>
        <button type="button" className="log-action-button" onClick={onClose}>
          <X size={14} />
          Close
        </button>
      </div>
      <div className="curve-picker">
        <div className="curve-picker-head">
          <span>Add from geophysical logs</span>
          <input value={curveSearch} placeholder="Find curve" onChange={(event) => setCurveSearch(event.target.value)} />
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
                  onClick={() => onAddCurve(curve)}
                >
                  <i style={{ backgroundColor: curve.color }} />
                  <span>{curveMnemonic(curve)}</span>
                  <small>{curve.unit || "-"}</small>
                </button>
              ))}
            </div>
          </section>
        ))}
        {!missingCurves.length && <div className="empty">All available curves are already configured on this track.</div>}
        {Boolean(missingCurves.length) && !filteredMissingCurves.length && <div className="empty">No curves match the current filter.</div>}
      </div>
    </section>
  );
}

function TrackSettings({
  track,
  index,
  tracks,
  availableCurves,
  selectedCurveKey,
  onUpdateTracks,
  onSelectTrack,
  onSelectCurve,
  onOpenCurveDictionary,
}: {
  track: DisplayTrack;
  index: number;
  tracks: DisplayTrack[];
  availableCurves: Curve[];
  selectedCurveKey: string | null;
  onUpdateTracks: (updater: (tracks: DisplayTrack[]) => DisplayTrack[]) => void;
  onSelectTrack: (trackId: string | null) => void;
  onSelectCurve: (curveKey: string | null) => void;
  onOpenCurveDictionary: () => void;
}) {
  const patchTrack = (patch: Partial<DisplayTrack>) => {
    onUpdateTracks((items) => patchLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id, patch).tracks ?? items);
  };
  const cloneTrack = () => {
    let nextTrackId: string | undefined;
    onUpdateTracks((items) => {
      const result = cloneLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id);
      nextTrackId = result.trackId;
      return result.widget.tracks ?? items;
    });
    if (nextTrackId) onSelectTrack(nextTrackId);
  };
  const curveSelected = track.type === "curve" && Boolean(selectedCurveKey);

  if (curveSelected) {
    return (
      <section className="track-editor track-editor-detail">
        <div className="track-editor-head">
          <div className="track-detail-title">
            <strong>Curve Settings</strong>
            <span>{track.title} track</span>
          </div>
          <button type="button" className="log-action-button" onClick={() => onSelectCurve(null)}>
            <Settings2 size={14} />
            Track settings
          </button>
        </div>
        <CurveTrackSettings
          track={track}
          availableCurves={availableCurves}
          selectedCurveKey={selectedCurveKey}
          patchTrack={patchTrack}
          onSelectCurve={onSelectCurve}
          onOpenCurveDictionary={onOpenCurveDictionary}
        />
      </section>
    );
  }

  return (
    <section className="track-editor track-editor-detail">
      <div className="track-editor-head">
        <div className="track-detail-title">
          <strong>Track Settings</strong>
          <span>{track.title}</span>
        </div>
        <div className="track-editor-actions">
          <label className="track-visible-toggle">
            <input type="checkbox" checked={track.visible} onChange={(event) => patchTrack({ visible: event.target.checked })} />
            Visible
          </label>
          <button
            type="button"
            disabled={index === 0}
            onClick={() =>
              onUpdateTracks((items) =>
                moveLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id, -1).widget.tracks ?? items,
              )
            }
          >
            <ArrowUp size={13} />
            Up
          </button>
          <button
            type="button"
            disabled={index === tracks.length - 1}
            onClick={() =>
              onUpdateTracks((items) =>
                moveLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id, 1).widget.tracks ?? items,
              )
            }
          >
            <ArrowDown size={13} />
            Down
          </button>
          <button type="button" onClick={cloneTrack}>
            <Copy size={13} />
            Clone
          </button>
          <button
            type="button"
            disabled={tracks.length <= 1}
            onClick={() => {
              const fallbackTrack = tracks[index + 1] ?? tracks[index - 1] ?? null;
              onUpdateTracks((items) =>
                removeLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id).widget.tracks ?? items,
              );
              onSelectTrack(fallbackTrack?.id ?? null);
              onSelectCurve(null);
            }}
          >
            <Trash2 size={13} />
            Delete track
          </button>
        </div>
      </div>

      <div className="track-settings-grid">
        <label>
          Title
          <input value={track.title} onChange={(event) => patchTrack({ title: event.target.value })} />
        </label>
        <label>
          Width
          <input type="number" min="40" max="600" value={track.width} onChange={(event) => patchTrack({ width: Number(event.target.value) })} />
        </label>
        <label>
          Header height
          <input
            type="number"
            min="24"
            max="180"
            value={track.header?.height ?? ""}
            placeholder="Auto"
            onChange={(event) =>
              patchTrack({
                header: {
                  ...(track.header ?? {}),
                  height: event.target.value ? Number(event.target.value) : undefined,
                },
              })
            }
          />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={track.interaction?.tooltipEnabled !== false}
            onChange={(event) =>
              patchTrack({
                interaction: {
                  ...(track.interaction ?? {}),
                  tooltipEnabled: event.target.checked,
                },
              })
            }
          />
          Tooltip
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={track.interaction?.contextMenuEnabled !== false}
            onChange={(event) =>
              patchTrack({
                interaction: {
                  ...(track.interaction ?? {}),
                  contextMenuEnabled: event.target.checked,
                },
              })
            }
          />
          Context menu
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={track.interaction?.selectable !== false}
            onChange={(event) =>
              patchTrack({
                interaction: {
                  ...(track.interaction ?? {}),
                  selectable: event.target.checked,
                },
              })
            }
          />
          Selectable
        </label>
      </div>

      {track.type === "curve" && (
        <CurveTrackSettings
          track={track}
          availableCurves={availableCurves}
          selectedCurveKey={selectedCurveKey}
          patchTrack={patchTrack}
          onSelectCurve={onSelectCurve}
          onOpenCurveDictionary={onOpenCurveDictionary}
        />
      )}
      {track.type === "seam" && <SeamTrackSettings track={track} patchTrack={patchTrack} />}
      {track.type === "remarks" && <RemarksTrackSettings track={track} patchTrack={patchTrack} />}
      {track.type === "quantitativeBar" && <QuantitativeTrackSettings track={track} patchTrack={patchTrack} />}
    </section>
  );
}
