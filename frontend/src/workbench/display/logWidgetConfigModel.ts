import type { Curve, DisplayTrack, DisplayWidget } from "../../api/types";
import { createCurveDisplayConfig, createTrackId, TRACK_CATALOG } from "./trackCatalog";

export type LogWidgetConfigResult =
  | { status: "changed"; widget: DisplayWidget; message: string; trackId?: string }
  | { status: "ignored"; widget: DisplayWidget; message: string; trackId?: string };

export function addCatalogTrackToLogWidget(
  widget: DisplayWidget,
  catalogId: string,
  availableCurves: Curve[] = [],
): LogWidgetConfigResult {
  const catalogItem = TRACK_CATALOG.find((item) => item.id === catalogId);
  if (!catalogItem) {
    return { status: "ignored", widget, message: `No track catalog item exists for ${catalogId}.` };
  }
  const tracks = widget.tracks ?? [];
  const nextTrack = withUniqueTrackId(catalogItem.create(availableCurves, new Set(tracks.map((track) => track.id))), tracks);
  return {
    status: "changed",
    widget: { ...widget, tracks: [...tracks, nextTrack] },
    message: `${catalogItem.label} track added to LogWidget.`,
    trackId: nextTrack.id,
  };
}

export function ensureCatalogTrackOnLogWidget(
  widget: DisplayWidget,
  catalogId: string,
  availableCurves: Curve[] = [],
): LogWidgetConfigResult {
  const catalogItem = TRACK_CATALOG.find((item) => item.id === catalogId);
  if (!catalogItem) {
    return { status: "ignored", widget, message: `No track catalog item exists for ${catalogId}.` };
  }
  const tracks = widget.tracks ?? [];
  const existing = tracks.find((track) => trackMatchesCatalog(track, catalogId));
  if (!existing) return addCatalogTrackToLogWidget(widget, catalogId, availableCurves);
  if (existing.visible) {
    return {
      status: "ignored",
      widget,
      message: `${catalogItem.label} track is already visible.`,
      trackId: existing.id,
    };
  }
  return {
    status: "changed",
    widget: {
      ...widget,
      tracks: tracks.map((track) => (track.id === existing.id ? { ...track, visible: true } : track)),
    },
    message: `${catalogItem.label} track is now visible.`,
    trackId: existing.id,
  };
}

export function addCurvesToLogWidget(widget: DisplayWidget, curves: Curve[]): LogWidgetConfigResult {
  if (!curves.length) {
    return { status: "ignored", widget, message: "No matching curve data exists for this borehole." };
  }

  const tracks = [...(widget.tracks ?? [])];
  const curveTrackIndex = tracks.findIndex((track) => track.type === "curve");
  const curveTrack =
    curveTrackIndex >= 0
      ? structuredClone(tracks[curveTrackIndex])
      : withUniqueTrackId(TRACK_CATALOG.find((item) => item.id === "curves")!.create([], new Set()), tracks);
  const result = addCurvesToTrack(curveTrack, curves);

  if (result.status === "ignored") {
    return { status: "ignored", widget, message: result.message, trackId: curveTrack.id };
  }

  if (curveTrackIndex >= 0) {
    tracks[curveTrackIndex] = result.track;
  } else {
    tracks.push(result.track);
  }

  return {
    status: "changed",
    widget: { ...widget, tracks },
    message: result.message,
    trackId: result.track.id,
  };
}

export function patchLogWidgetTrack(
  widget: DisplayWidget,
  trackId: string,
  patch: Partial<DisplayTrack>,
): DisplayWidget {
  return {
    ...widget,
    tracks: (widget.tracks ?? []).map((track) => (track.id === trackId ? { ...track, ...patch } : track)),
  };
}

export function cloneLogWidgetTrack(widget: DisplayWidget, trackId: string): LogWidgetConfigResult {
  const tracks = widget.tracks ?? [];
  const index = tracks.findIndex((track) => track.id === trackId);
  const source = tracks[index];
  if (!source) return { status: "ignored", widget, message: "Track was not found." };
  const id = createTrackId(`${source.id}-copy`, new Set(tracks.map((track) => track.id)));
  const clone = { ...structuredClone(source), id, title: `${source.title} Copy` };
  return {
    status: "changed",
    widget: {
      ...widget,
      tracks: [...tracks.slice(0, index + 1), clone, ...tracks.slice(index + 1)],
    },
    message: `${source.title} track cloned.`,
    trackId: id,
  };
}

export function removeLogWidgetTrack(widget: DisplayWidget, trackId: string): LogWidgetConfigResult {
  const tracks = widget.tracks ?? [];
  if (tracks.length <= 1) return { status: "ignored", widget, message: "LogWidget must keep at least one track." };
  if (!tracks.some((track) => track.id === trackId)) return { status: "ignored", widget, message: "Track was not found." };
  return {
    status: "changed",
    widget: { ...widget, tracks: tracks.filter((track) => track.id !== trackId) },
    message: "Track removed from LogWidget.",
  };
}

export function moveLogWidgetTrack(widget: DisplayWidget, trackId: string, direction: -1 | 1): LogWidgetConfigResult {
  const tracks = widget.tracks ?? [];
  const index = tracks.findIndex((track) => track.id === trackId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= tracks.length) {
    return { status: "ignored", widget, message: "Track cannot be moved in that direction." };
  }
  const next = [...tracks];
  const [track] = next.splice(index, 1);
  next.splice(target, 0, track);
  return {
    status: "changed",
    widget: { ...widget, tracks: next },
    message: "Track order updated.",
    trackId,
  };
}

export function addCurvesToTrack(track: DisplayTrack, curves: Curve[]) {
  if (track.type !== "curve") {
    return { status: "ignored" as const, track, message: "Curves can only be added to a curve track." };
  }
  const existingCurveKeys = new Set((track.curves ?? []).map((curve) => curve.curveKey));
  const newCurves = curves.filter((curve) => !existingCurveKeys.has(curve.key));
  if (!newCurves.length) {
    return { status: "ignored" as const, track, message: "Selected curve is already present in the curve track." };
  }
  const curveConfigs = [...(track.curves ?? []), ...newCurves.map(createCurveDisplayConfig)];
  return {
    status: "changed" as const,
    track: {
      ...track,
      visible: true,
      curves: curveConfigs,
      width: Math.max(track.width, curveConfigs.length > 3 ? 320 : track.width),
    },
    message: `${newCurves.length} curve${newCurves.length === 1 ? "" : "s"} added to LogWidget.`,
  };
}

function trackMatchesCatalog(track: DisplayTrack, catalogId: string) {
  if (catalogId === "recovery") return track.type === "quantitativeBar" && track.valueField === "recovery_percent";
  if (catalogId === "rqd") return track.type === "quantitativeBar" && track.valueField === "rqd";
  if (catalogId === "curves") return track.type === "curve";
  const catalogItem = TRACK_CATALOG.find((item) => item.id === catalogId);
  if (!catalogItem) return false;
  const template = catalogItem.create([]);
  return track.type === template.type;
}

function withUniqueTrackId(track: DisplayTrack, tracks: DisplayTrack[]) {
  return { ...track, id: createTrackId(track.id, new Set(tracks.map((item) => item.id))) };
}
