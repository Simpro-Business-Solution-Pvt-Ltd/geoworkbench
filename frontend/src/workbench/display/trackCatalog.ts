import type { Curve, DisplayTrack } from "../../api/types";
import { compareCurvesByFamily } from "../data/curveDictionary";

export type TrackCatalogItem = {
  id: string;
  label: string;
  category: "axis" | "geology" | "quality" | "geophysics" | "evidence" | "assistant";
  description: string;
  create: (availableCurves: Curve[], existingIds?: Set<string>) => DisplayTrack;
};

export const TRACK_CATALOG: TrackCatalogItem[] = [
  {
    id: "depth",
    label: "Depth",
    category: "axis",
    description: "Depth ruler with adaptive ticks for the visible log interval.",
    create: () => ({ id: "depth", type: "depthAxis", title: "Depth", visible: true, width: 70 }),
  },
  {
    id: "lithology",
    label: "Lithology",
    category: "geology",
    description: "Depth intervals colored and patterned by interpreted lithology.",
    create: () => ({
      id: "lithology",
      type: "lithology",
      title: "Lithology",
      visible: true,
      width: 180,
    }),
  },
  {
    id: "seam",
    label: "Seam",
    category: "geology",
    description: "Coal seam markers and interval labels used for review and correlation.",
    create: () => ({ id: "seam", type: "seam", title: "Seam", visible: true, width: 90 }),
  },
  {
    id: "core-images",
    label: "Core Images",
    category: "evidence",
    description: "Depth-aligned core image state or prepared core image strips when available.",
    create: () => ({
      id: "core-images",
      type: "images",
      title: "Core Images",
      visible: true,
      width: 170,
    }),
  },
  {
    id: "recovery",
    label: "Recovery",
    category: "quality",
    description: "Interval recovery percentage as a depth-aligned quantitative bar.",
    create: () => ({
      id: "recovery",
      type: "quantitativeBar",
      title: "Recovery",
      visible: true,
      width: 110,
      valueField: "recovery_percent",
      unit: "%",
      min: 0,
      max: 100,
      color: "#55b7aa",
    }),
  },
  {
    id: "rqd",
    label: "RQD",
    category: "quality",
    description: "Rock quality designation as a depth-aligned quantitative bar.",
    create: () => ({
      id: "rqd",
      type: "quantitativeBar",
      title: "RQD",
      visible: true,
      width: 100,
      valueField: "rqd",
      unit: "%",
      min: 0,
      max: 100,
      valueMultiplier: 100,
      color: "#55b7aa",
    }),
  },
  {
    id: "curves",
    label: "Curve Track",
    category: "geophysics",
    description: "One or more geophysical curves normalized into the same track real estate.",
    create: (availableCurves) => ({
      id: "curves",
      type: "curve",
      title: "Curves",
      visible: true,
      width: 260,
      curves: orderedCurves(availableCurves).map((curve) => createCurveDisplayConfig(curve)),
    }),
  },
  {
    id: "remarks",
    label: "Remarks",
    category: "evidence",
    description: "Grouped field/geologist remarks arranged on the depth axis.",
    create: () => ({ id: "remarks", type: "remarks", title: "Remarks", visible: true, width: 220 }),
  },
  {
    id: "ai-suggestions",
    label: "AI Suggestions",
    category: "assistant",
    description: "Rule and AI review markers linked to intervals or depth ranges.",
    create: () => ({
      id: "ai-suggestions",
      type: "aiSuggestions",
      title: "AI",
      visible: true,
      width: 120,
    }),
  },
];

export function defaultTracks(availableCurves: Curve[]): DisplayTrack[] {
  return TRACK_CATALOG.map((item) => item.create(availableCurves, new Set()));
}

export function createTrackId(baseId: string, existingIds: Set<string>) {
  let index = 1;
  let id = baseId;
  while (existingIds.has(id)) {
    index += 1;
    id = `${baseId}-${index}`;
  }
  return id;
}

export function defaultScaleForCurve(curve: Curve) {
  const values = curve.samples.map((sample) => sample.value);
  if (!values.length) {
    return { mode: "manual", min: 0, max: 100 };
  }
  const min = Math.floor(Math.min(...values));
  const max = Math.ceil(Math.max(...values));
  return { mode: "manual", min, max: max <= min ? min + 1 : max };
}

export function syncTrackCurves(tracks: DisplayTrack[], availableCurves: Curve[]): DisplayTrack[] {
  return tracks.map((track) => {
    if (track.type !== "curve") return track;
    const configured = track.curves ?? [];
    const configuredByKey = new Map(configured.map((curve) => [curve.curveKey, curve]));
    const sourceCurves =
      configured.length > 0
        ? configured
            .map((config) => availableCurves.find((curve) => curve.key === config.curveKey))
            .filter((curve): curve is Curve => Boolean(curve))
        : orderedCurves(availableCurves);
    const curves = sourceCurves.map((curve) => {
      const existing = configuredByKey.get(curve.key);
      return existing
        ? {
            ...existing,
            label: existing.label || curve.label,
            unit: existing.unit || curve.unit,
            color: existing.color || curve.color,
            visible: existing.visible ?? true,
            tooltipEnabled: existing.tooltipEnabled ?? true,
            lineStyle: existing.lineStyle ?? "solid",
            scale: existing.scale ?? defaultScaleForCurve(curve),
          }
        : createCurveDisplayConfig(curve);
    });
    return {
      ...track,
      curves,
      width: Math.max(track.width, availableCurves.length > 3 ? 320 : track.width),
    };
  });
}

export function createCurveDisplayConfig(curve: Curve) {
  return {
    curveKey: curve.key,
    label: curve.label,
    unit: curve.unit,
    color: curve.color,
    visible: true,
    tooltipEnabled: true,
    lineStyle: "solid",
    scale: defaultScaleForCurve(curve),
  };
}

function orderedCurves(curves: Curve[]) {
  const preferredOrder = ["calp_incl", "ngamma", "sp", "res", "dens", "spr"];
  return [...curves].sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.key);
    const rightIndex = preferredOrder.indexOf(right.key);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }
    return compareCurvesByFamily(left, right);
  });
}
