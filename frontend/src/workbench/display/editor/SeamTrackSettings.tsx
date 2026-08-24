import type { DisplayTrack } from "../../../api/types";
import { optionalNumber, rendererNumber } from "./trackSettingInputs";

type Props = {
  track: DisplayTrack;
  patchTrack: (patch: Partial<DisplayTrack>) => void;
};

export function SeamTrackSettings({ track, patchTrack }: Props) {
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
