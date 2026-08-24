import type { DisplayTrack } from "../../../api/types";
import { optionalNumber } from "./trackSettingInputs";

type Props = {
  track: DisplayTrack;
  patchTrack: (patch: Partial<DisplayTrack>) => void;
};

export function QuantitativeTrackSettings({ track, patchTrack }: Props) {
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
