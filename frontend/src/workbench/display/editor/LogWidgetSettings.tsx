import type { Curve, DisplayTrack, DisplayWidget } from "../../../api/types";
import { createTrackId, TRACK_CATALOG } from "../trackCatalog";
import { CurveTrackSettings } from "./CurveTrackSettings";
import { moveItem } from "./displayGridUtils";

type Props = {
  widget: DisplayWidget;
  availableCurves: Curve[];
  onUpdateWidget: (updater: (widget: DisplayWidget) => DisplayWidget) => void;
};

export function LogWidgetSettings({ widget, availableCurves, onUpdateWidget }: Props) {
  const tracks = widget.tracks ?? [];
  const existingTrackIds = new Set(tracks.map((track) => track.id));

  const updateTracks = (updater: (tracks: DisplayTrack[]) => DisplayTrack[]) => {
    onUpdateWidget((item) => ({ ...item, tracks: updater(item.tracks ?? []) }));
  };

  return (
    <div className="log-widget-settings">
      <section className="track-editor">
        <strong>Add Track</strong>
        <div className="catalog-actions">
          {TRACK_CATALOG.map((item) => (
            <button
              key={item.id}
              type="button"
              title={`${item.category}: ${item.description}`}
              onClick={() =>
                updateTracks((items) => {
                  const id = createTrackId(item.id, new Set(items.map((track) => track.id)));
                  return [...items, { ...item.create(availableCurves, existingTrackIds), id }];
                })
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tracks.map((track, index) => (
        <TrackSettings
          key={track.id}
          track={track}
          index={index}
          tracks={tracks}
          availableCurves={availableCurves}
          onUpdateTracks={updateTracks}
        />
      ))}
    </div>
  );
}

function TrackSettings({
  track,
  index,
  tracks,
  availableCurves,
  onUpdateTracks,
}: {
  track: DisplayTrack;
  index: number;
  tracks: DisplayTrack[];
  availableCurves: Curve[];
  onUpdateTracks: (updater: (tracks: DisplayTrack[]) => DisplayTrack[]) => void;
}) {
  const patchTrack = (patch: Partial<DisplayTrack>) => {
    onUpdateTracks((items) => items.map((item) => (item.id === track.id ? { ...item, ...patch } : item)));
  };

  return (
    <section className="track-editor">
      <div className="track-editor-head">
        <label>
          <input type="checkbox" checked={track.visible} onChange={(event) => patchTrack({ visible: event.target.checked })} />
          <span>{track.title}</span>
        </label>
        <div>
          <button type="button" disabled={index === 0} onClick={() => onUpdateTracks((items) => moveItem(items, index, index - 1))}>
            Up
          </button>
          <button
            type="button"
            disabled={index === tracks.length - 1}
            onClick={() => onUpdateTracks((items) => moveItem(items, index, index + 1))}
          >
            Down
          </button>
          <button type="button" disabled={tracks.length <= 1} onClick={() => onUpdateTracks((items) => items.filter((item) => item.id !== track.id))}>
            Remove
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
      </div>

      {track.type === "curve" && <CurveTrackSettings track={track} availableCurves={availableCurves} patchTrack={patchTrack} />}
      {track.type === "seam" && <SeamTrackSettings track={track} patchTrack={patchTrack} />}
      {track.type === "quantitativeBar" && <QuantitativeTrackSettings track={track} patchTrack={patchTrack} />}
    </section>
  );
}

function SeamTrackSettings({
  track,
  patchTrack,
}: {
  track: DisplayTrack;
  patchTrack: (patch: Partial<DisplayTrack>) => void;
}) {
  const labelMinHeightPx = rendererNumber(track, "labelMinHeightPx");
  const labelMaxVisibleSpanM = rendererNumber(track, "labelMaxVisibleSpanM");
  const patchRenderer = (key: string, value: number | undefined) => {
    patchTrack({
      renderer: {
        ...(track.renderer ?? {}),
        [key]: value,
      },
    });
  };

  return (
    <div className="curve-settings-list">
      <strong>Seam Labels</strong>
      <div className="curve-scale-grid">
        <label>
          Min label height
          <input
            type="number"
            min="4"
            max="80"
            value={labelMinHeightPx ?? ""}
            placeholder="18"
            onChange={(event) => patchRenderer("labelMinHeightPx", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Max visible span
          <input
            type="number"
            min="10"
            step="10"
            value={labelMaxVisibleSpanM ?? ""}
            placeholder="160"
            onChange={(event) => patchRenderer("labelMaxVisibleSpanM", optionalNumber(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}

function rendererNumber(track: DisplayTrack, key: string) {
  const value = track.renderer?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalNumber(value: string) {
  return value ? Number(value) : undefined;
}

function QuantitativeTrackSettings({
  track,
  patchTrack,
}: {
  track: DisplayTrack;
  patchTrack: (patch: Partial<DisplayTrack>) => void;
}) {
  return (
    <div className="curve-settings-list">
      <strong>Quantitative Bar</strong>
      <div className="curve-scale-grid">
        <label>
          Data field
          <select
            value={track.valueField ?? "recovery_percent"}
            onChange={(event) =>
              patchTrack({
                valueField: event.target.value === "rqd" ? "rqd" : "recovery_percent",
              })
            }
          >
            <option value="recovery_percent">Recovery %</option>
            <option value="rqd">RQD</option>
          </select>
        </label>
        <label>
          Unit
          <input value={track.unit ?? ""} placeholder="%" onChange={(event) => patchTrack({ unit: event.target.value })} />
        </label>
        <label>
          Min
          <input
            type="number"
            value={track.min ?? ""}
            placeholder="0"
            onChange={(event) => patchTrack({ min: optionalNumber(event.target.value) })}
          />
        </label>
        <label>
          Max
          <input
            type="number"
            value={track.max ?? ""}
            placeholder="100"
            onChange={(event) => patchTrack({ max: optionalNumber(event.target.value) })}
          />
        </label>
        <label>
          Multiplier
          <input
            type="number"
            step="0.1"
            value={track.valueMultiplier ?? ""}
            placeholder="1"
            onChange={(event) => patchTrack({ valueMultiplier: optionalNumber(event.target.value) })}
          />
        </label>
        <label>
          Color
          <input type="color" value={track.color ?? "#55b7aa"} onChange={(event) => patchTrack({ color: event.target.value })} />
        </label>
      </div>
    </div>
  );
}
