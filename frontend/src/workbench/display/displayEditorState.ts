import type { DisplayLayout } from "../../api/types";

export type DisplayEditorSummary = {
  widgetCount: number;
  gridItemCount: number;
  logTrackCount: number;
  configuredCurveCount: number;
};

export function displayLayoutsEqual(left: DisplayLayout | null, right: DisplayLayout | null): boolean {
  if (!left || !right) return left === right;
  return stableLayoutSignature(left) === stableLayoutSignature(right);
}

export function buildDisplayEditorSummary(layout: DisplayLayout | null): DisplayEditorSummary {
  const widgets = layout?.settings.widgets ?? {};
  const gridItems = layout?.settings.grid?.items ?? [];
  const logWidgets = Object.values(widgets).filter((widget) => widget.type === "logWidget");
  const logTrackCount = logWidgets.reduce((sum, widget) => sum + (widget.tracks?.length ?? 0), 0);
  const configuredCurveCount = logWidgets.reduce(
    (sum, widget) =>
      sum +
      (widget.tracks ?? []).reduce(
        (trackSum, track) => trackSum + (track.type === "curve" ? track.curves?.length ?? 0 : 0),
        0,
      ),
    0,
  );
  return {
    widgetCount: Object.keys(widgets).length,
    gridItemCount: gridItems.length,
    logTrackCount,
    configuredCurveCount,
  };
}

function stableLayoutSignature(layout: DisplayLayout): string {
  return JSON.stringify({
    name: layout.name,
    mode: layout.mode,
    settings: layout.settings,
  });
}
