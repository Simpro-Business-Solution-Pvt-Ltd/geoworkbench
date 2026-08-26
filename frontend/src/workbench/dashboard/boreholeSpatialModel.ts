import type { BoreholeListItem } from "../../api/types";

export type BoreholeMapPoint = {
  id: number;
  code: string;
  title: string;
  x: number;
  y: number;
  system: string;
  xLabel: string;
  yLabel: string;
  projectCode: string;
  siteCode: string;
  workflowStatus: string;
};

export type BoreholeMapModel = {
  points: BoreholeMapPoint[];
  missing: BoreholeListItem[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  coordinateSystem: string | null;
};

export function buildBoreholeMapModel(boreholes: BoreholeListItem[]): BoreholeMapModel {
  const points: BoreholeMapPoint[] = [];
  const missing: BoreholeListItem[] = [];
  for (const borehole of boreholes) {
    const coordinates = borehole.coordinates;
    if (!coordinates || !Number.isFinite(coordinates.x) || !Number.isFinite(coordinates.y)) {
      missing.push(borehole);
      continue;
    }
    points.push({
      id: borehole.id,
      code: borehole.code,
      title: borehole.title,
      x: coordinates.x,
      y: coordinates.y,
      system: coordinates.system,
      xLabel: coordinates.x_label,
      yLabel: coordinates.y_label,
      projectCode: borehole.project_code,
      siteCode: borehole.site_code,
      workflowStatus: borehole.workflow_status,
    });
  }

  if (!points.length) {
    return { points, missing, bounds: null, coordinateSystem: null };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const coordinateSystem = mostCommon(points.map((point) => point.system));
  return {
    points,
    missing,
    bounds: {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    },
    coordinateSystem,
  };
}

export function projectBoreholePoint(
  point: BoreholeMapPoint,
  bounds: NonNullable<BoreholeMapModel["bounds"]>,
  width: number,
  height: number,
  padding = 28,
) {
  const drawableWidth = Math.max(1, width - padding * 2);
  const drawableHeight = Math.max(1, height - padding * 2);
  const xSpan = Math.max(1, bounds.maxX - bounds.minX);
  const ySpan = Math.max(1, bounds.maxY - bounds.minY);
  return {
    x: padding + ((point.x - bounds.minX) / xSpan) * drawableWidth,
    y: padding + (1 - (point.y - bounds.minY) / ySpan) * drawableHeight,
  };
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}
