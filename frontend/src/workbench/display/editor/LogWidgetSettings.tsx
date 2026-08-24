import type { Curve, DisplayTrack, DisplayWidget } from "../../../api/types";
import {
  addCatalogTrackToLogWidget,
  cloneLogWidgetTrack,
  moveLogWidgetTrack,
  patchLogWidgetTrack,
  removeLogWidgetTrack,
} from "../logWidgetConfigModel";
import { TRACK_CATALOG } from "../trackCatalog";
import { CurveTrackSettings } from "./CurveTrackSettings";
import { QuantitativeTrackSettings } from "./QuantitativeTrackSettings";
import { RemarksTrackSettings } from "./RemarksTrackSettings";
import { SeamTrackSettings } from "./SeamTrackSettings";

type Props = {
  widget: DisplayWidget;
  availableCurves: Curve[];
  onUpdateWidget: (updater: (widget: DisplayWidget) => DisplayWidget) => void;
};

export function LogWidgetSettings({ widget, availableCurves, onUpdateWidget }: Props) {
  const tracks = widget.tracks ?? [];
  const trackGroups = TRACK_CATALOG.reduce<Record<string, typeof TRACK_CATALOG>>((groups, item) => {
    groups[item.category] = [...(groups[item.category] ?? []), item];
    return groups;
  }, {});

  const updateTracks = (updater: (tracks: DisplayTrack[]) => DisplayTrack[]) => {
    onUpdateWidget((item) => ({ ...item, tracks: updater(item.tracks ?? []) }));
  };

  return (
    <div className="log-widget-settings">
      <section className="track-editor">
        <strong>Add Track</strong>
        <div className="track-catalog-groups">
          {Object.entries(trackGroups).map(([category, group]) => (
            <div key={category} className="track-catalog-group">
              <span>{category}</span>
              <div className="catalog-actions">
                {group.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    title={item.description}
                    onClick={() =>
                      onUpdateWidget((current) =>
                        addCatalogTrackToLogWidget(current, item.id, availableCurves).widget,
                      )
                    }
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
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
    onUpdateTracks((items) => patchLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id, patch).tracks ?? items);
  };
  const cloneTrack = () => {
    onUpdateTracks((items) => cloneLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id).widget.tracks ?? items);
  };

  return (
    <section className="track-editor">
      <div className="track-editor-head">
        <label>
          <input type="checkbox" checked={track.visible} onChange={(event) => patchTrack({ visible: event.target.checked })} />
          <span>{track.title}</span>
        </label>
        <div>
          <button
            type="button"
            disabled={index === 0}
            onClick={() =>
              onUpdateTracks((items) =>
                moveLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id, -1).widget.tracks ?? items,
              )
            }
          >
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
            Down
          </button>
          <button type="button" onClick={cloneTrack}>
            Clone
          </button>
          <button
            type="button"
            disabled={tracks.length <= 1}
            onClick={() =>
              onUpdateTracks((items) =>
                removeLogWidgetTrack({ type: "logWidget", title: "Borehole Log", tracks: items }, track.id).widget.tracks ?? items,
              )
            }
          >
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

      {track.type === "curve" && <CurveTrackSettings track={track} availableCurves={availableCurves} patchTrack={patchTrack} />}
      {track.type === "seam" && <SeamTrackSettings track={track} patchTrack={patchTrack} />}
      {track.type === "remarks" && <RemarksTrackSettings track={track} patchTrack={patchTrack} />}
      {track.type === "quantitativeBar" && <QuantitativeTrackSettings track={track} patchTrack={patchTrack} />}
    </section>
  );
}
