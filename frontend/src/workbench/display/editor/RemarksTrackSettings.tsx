import type { DisplayTrack } from "../../../api/types";
import { optionalNumber, rendererNumber } from "./trackSettingInputs";

type Props = {
  track: DisplayTrack;
  patchTrack: (patch: Partial<DisplayTrack>) => void;
};

export function RemarksTrackSettings({ track, patchTrack }: Props) {
  const bucketPixels = rendererNumber(track, "bucketPixels");
  const hitHeightPx = rendererNumber(track, "hitHeightPx");
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
      <strong>Remark Grouping</strong>
      <div className="curve-scale-grid">
        <label>
          Bucket pixels
          <input
            type="number"
            min="8"
            max="80"
            value={bucketPixels ?? ""}
            placeholder="26"
            onChange={(event) => patchRenderer("bucketPixels", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Hit height
          <input
            type="number"
            min="8"
            max="80"
            value={hitHeightPx ?? ""}
            placeholder="26"
            onChange={(event) => patchRenderer("hitHeightPx", optionalNumber(event.target.value))}
          />
        </label>
        <label>
          Max label span
          <input
            type="number"
            min="10"
            step="10"
            value={labelMaxVisibleSpanM ?? ""}
            placeholder="120"
            onChange={(event) => patchRenderer("labelMaxVisibleSpanM", optionalNumber(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
