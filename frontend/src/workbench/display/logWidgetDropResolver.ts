import type { BoreholeWorkbench, DisplayTrack, DisplayWidget } from "../../api/types";
import type { BoreholeExplorerDragPayload } from "../explorer/boreholeExplorerModel";
import { createCurveDisplayConfig, createTrackId, TRACK_CATALOG } from "./trackCatalog";

export type LogWidgetDropResult =
  | {
      status: "changed";
      widget: DisplayWidget;
      message: string;
    }
  | {
      status: "ignored";
      widget: DisplayWidget;
      message: string;
    };

export function resolveLogWidgetDrop(
  widget: DisplayWidget,
  payload: BoreholeExplorerDragPayload,
  data: BoreholeWorkbench,
): LogWidgetDropResult {
  if (widget.type !== "logWidget") {
    return { status: "ignored", widget, message: "Target widget is not a LogWidget." };
  }

  if (payload.kind === "curve") {
    return addCurves(widget, [payload.curveKey], data);
  }

  if (payload.kind === "curveGroup") {
    return addCurves(widget, payload.curveKeys, data);
  }

  if (payload.kind === "intervalSet") {
    return ensureTrack(widget, payload.intervalType === "seam" ? "seam" : "lithology");
  }

  if (payload.kind === "intervalField") {
    if (payload.field === "recovery_percent") {
      return ensureTrack(widget, "recovery");
    }
    if (payload.field === "rqd") {
      return ensureTrack(widget, "rqd");
    }
    if (payload.field === "remark" || payload.field === "structural_features") {
      return ensureTrack(widget, "remarks");
    }
    if (payload.field === "seam_name") {
      return ensureTrack(widget, "seam");
    }
    return { status: "ignored", widget, message: `No LogWidget track mapping exists for ${payload.field}.` };
  }

  if (payload.kind === "image" || payload.kind === "imageGroup") {
    return ensureTrack(widget, "core-images");
  }

  if (payload.kind === "qualityIssue" || payload.kind === "aiSuggestion") {
    return ensureTrack(widget, "ai-suggestions");
  }

  return { status: "ignored", widget, message: "This explorer item is available for inspection only." };
}

function addCurves(widget: DisplayWidget, curveKeys: string[], data: BoreholeWorkbench): LogWidgetDropResult {
  const curvesByKey = new Map(data.curves.map((curve) => [curve.key, curve]));
  const curves = curveKeys.map((key) => curvesByKey.get(key)).filter((curve): curve is NonNullable<typeof curve> => Boolean(curve));
  if (!curves.length) {
    return { status: "ignored", widget, message: "No matching curve data exists for this borehole." };
  }

  const tracks = [...(widget.tracks ?? [])];
  const curveTrackIndex = tracks.findIndex((track) => track.type === "curve");
  const curveTrack =
    curveTrackIndex >= 0
      ? structuredClone(tracks[curveTrackIndex])
      : createTrackFromCatalog("curves", []);
  const existingCurveKeys = new Set((curveTrack.curves ?? []).map((curve) => curve.curveKey));
  const newCurves = curves.filter((curve) => !existingCurveKeys.has(curve.key));

  if (!newCurves.length) {
    return { status: "ignored", widget, message: "Selected curve is already present in the curve track." };
  }

  curveTrack.curves = [...(curveTrack.curves ?? []), ...newCurves.map(createCurveDisplayConfig)];
  curveTrack.visible = true;
  curveTrack.width = Math.max(curveTrack.width, curveTrack.curves.length > 3 ? 320 : curveTrack.width);

  if (curveTrackIndex >= 0) {
    tracks[curveTrackIndex] = curveTrack;
  } else {
    tracks.push(withUniqueTrackId(curveTrack, tracks));
  }

  return {
    status: "changed",
    widget: { ...widget, tracks },
    message: `${newCurves.length} curve${newCurves.length === 1 ? "" : "s"} added to LogWidget.`,
  };
}

function ensureTrack(widget: DisplayWidget, catalogId: string): LogWidgetDropResult {
  const tracks = widget.tracks ?? [];
  const catalogItem = TRACK_CATALOG.find((item) => item.id === catalogId);
  if (!catalogItem) {
    return { status: "ignored", widget, message: `No track catalog item exists for ${catalogId}.` };
  }

  const existing = tracks.find((track) => track.type === catalogItem.create([]).type && track.id === catalogId);
  if (existing) {
    if (existing.visible) return { status: "ignored", widget, message: `${catalogItem.label} track is already visible.` };
    return {
      status: "changed",
      widget: {
        ...widget,
        tracks: tracks.map((track) => (track.id === existing.id ? { ...track, visible: true } : track)),
      },
      message: `${catalogItem.label} track is now visible.`,
    };
  }

  const nextTrack = withUniqueTrackId(catalogItem.create([]), tracks);
  return {
    status: "changed",
    widget: { ...widget, tracks: [...tracks, nextTrack] },
    message: `${catalogItem.label} track added to LogWidget.`,
  };
}

function createTrackFromCatalog(catalogId: string, curves: BoreholeWorkbench["curves"]) {
  const item = TRACK_CATALOG.find((candidate) => candidate.id === catalogId);
  if (!item) throw new Error(`Unknown track catalog item: ${catalogId}`);
  return item.create(curves);
}

function withUniqueTrackId(track: DisplayTrack, tracks: DisplayTrack[]) {
  return { ...track, id: createTrackId(track.id, new Set(tracks.map((item) => item.id))) };
}
