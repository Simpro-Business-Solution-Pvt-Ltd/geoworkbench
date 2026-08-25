import type { BoreholeWorkbench, Curve } from "../../api/types";
import { metadataFor, rlLabel, type BoreholeMeta } from "./correlationMetadata";

export type CorrelationAlignMode = "depth" | "rl";

export type CorrelationInsight = {
  id: string;
  severity: "review" | "watch" | "good";
  title: string;
  detail: string;
  evidence: string;
  action: string;
  target?: CorrelationInvestigationTarget;
};

export type CorrelationInvestigationTarget = {
  boreholeId: number;
  boreholeCode: string;
  depth: number;
  reason: string;
};

export type SeamCorrelationRow = {
  seamName: string;
  presentCount: number;
  missingCount: number;
  minTop: number;
  maxTop: number;
  minThickness: number;
  maxThickness: number;
  items: Array<{ borehole: string; top: number; bottom: number; thickness: number }>;
};

export type CollarContextRow = {
  boreholeId: number;
  borehole: string;
  x: number | null;
  y: number | null;
  isReference: boolean;
  rlLabel: string;
  rlSource: BoreholeMeta["rlSource"];
  waterLevel: number | null;
  distanceFromReference: number | null;
  seamCount: number;
  curveCount: number;
};

export function seamCorrelationRows(items: BoreholeWorkbench[]): SeamCorrelationRow[] {
  const groups = new Map<string, SeamCorrelationRow["items"]>();
  for (const data of items) {
    for (const seam of data.seam_intervals) {
      const name = (seam.name || "Unnamed seam").trim().toUpperCase();
      const current = groups.get(name) ?? [];
      current.push({
        borehole: data.code,
        top: seam.from_depth,
        bottom: seam.to_depth,
        thickness: Math.max(0, seam.to_depth - seam.from_depth),
      });
      groups.set(name, current);
    }
  }

  return Array.from(groups.entries())
    .map(([seamName, groupItems]) => {
      const tops = groupItems.map((item) => item.top);
      const thicknesses = groupItems.map((item) => item.thickness);
      const boreholeCount = new Set(groupItems.map((item) => item.borehole)).size;
      return {
        seamName,
        presentCount: boreholeCount,
        missingCount: Math.max(0, items.length - boreholeCount),
        minTop: Math.min(...tops),
        maxTop: Math.max(...tops),
        minThickness: Math.min(...thicknesses),
        maxThickness: Math.max(...thicknesses),
        items: groupItems,
      };
    })
    .sort((a, b) => b.presentCount - a.presentCount || a.minTop - b.minTop);
}

export function collarContextRows(items: BoreholeWorkbench[], referenceBoreholeId?: number | null): CollarContextRow[] {
  const referenceItem =
    items.find((item) => item.id === referenceBoreholeId && hasCoordinates(metadataFor(item))) ??
    items.find((item) => hasCoordinates(metadataFor(item))) ??
    null;
  const reference = referenceItem ? metadataFor(referenceItem) : null;
  return items.map((item) => {
    const meta = metadataFor(item);
    const distanceFromReference =
      reference && meta.x !== null && meta.y !== null
        ? Math.hypot(meta.x - reference.x!, meta.y - reference.y!)
        : null;
    return {
      boreholeId: item.id,
      borehole: item.code,
      x: meta.x,
      y: meta.y,
      isReference: referenceItem?.id === item.id,
      rlLabel: rlLabel(meta),
      rlSource: meta.rlSource,
      waterLevel: meta.waterLevel,
      distanceFromReference,
      seamCount: item.seam_intervals.length,
      curveCount: item.curves.length,
    };
  });
}

function hasCoordinates(meta: BoreholeMeta) {
  return meta.x !== null && meta.y !== null;
}

export function buildCorrelationInsights(
  items: BoreholeWorkbench[],
  seamRows: SeamCorrelationRow[],
): CorrelationInsight[] {
  if (!items.length) {
    return [
      {
        id: "empty",
        severity: "watch",
        title: "Select boreholes for correlation",
        detail: "Choose nearby boreholes to compare seam continuity, lithology packages, and curve response.",
        evidence: "No boreholes selected.",
        action: "Select two or more nearby boreholes with collar coordinates, lithology intervals, and curve evidence.",
      },
    ];
  }

  const insights: CorrelationInsight[] = [];
  const selectedCodes = items.map((item) => item.code).join(", ");
  const commonSeams = seamRows.filter((row) => row.presentCount >= Math.max(2, Math.ceil(items.length * 0.6)));
  const missingSeams = seamRows.filter((row) => row.missingCount > 0 && row.presentCount >= 2);
  const variableSeams = seamRows.filter((row) => row.maxThickness - row.minThickness >= 1);
  const topSpreadSeams = seamRows.filter((row) => row.presentCount >= 2 && row.maxTop - row.minTop >= 10);
  const curveCoverage = items.map((item) => ({
    code: item.code,
    curves: item.curves.length,
    hasGamma: item.curves.some(isGammaCurve),
  }));
  const curveGaps = curveCoverage.filter((item) => !item.hasGamma || item.curves < 2);
  const defaultRl = items.filter((item) => metadataFor(item).rlSource === "default");
  const missingCoordinates = items.filter((item) => {
    const meta = metadataFor(item);
    return meta.x === null || meta.y === null;
  });

  insights.push({
    id: "selected",
    severity: commonSeams.length ? "good" : "watch",
    title: `${items.length} boreholes compared`,
    detail:
      commonSeams.length > 0
        ? `${commonSeams.length} seam group(s) appear continuous enough for geologist review.`
        : "No dominant common seam group is visible across the selected boreholes.",
    evidence: selectedCodes,
    action:
      commonSeams.length > 0
        ? "Open the strongest seam groups and record whether continuity is accepted, uncertain, or rejected."
        : "Review seam naming and lithology intervals before treating this set as a correlation section.",
  });

  if (defaultRl.length) {
    insights.push({
      id: "rl-defaulted",
      severity: "watch",
      title: "RL datum needs confirmation",
      detail:
        "One or more selected boreholes do not expose collar reduced level in the imported metadata. RL alignment is using a placeholder datum for those boreholes.",
      evidence: defaultRl.map((item) => item.code).join(" · "),
      action: "Confirm collar RL from survey/collar sheet before using RL alignment for geological interpretation.",
    });
  }

  if (missingCoordinates.length) {
    insights.push({
      id: "missing-coordinates",
      severity: "review",
      title: "Spatial context is incomplete",
      detail:
        "Some selected boreholes do not expose collar coordinates. Spatial distance and nearby-borehole correlation confidence should be reviewed.",
      evidence: missingCoordinates.map((item) => item.code).join(" · "),
      action: "Import or enter collar coordinates so the section can distinguish nearby continuity from distant comparison.",
    });
  }

  if (missingSeams.length) {
    const seam = missingSeams[0];
    const missingItem = items.find(
      (item) =>
        !seam.items.some((seamItem) => seamItem.borehole === item.code),
    );
    const expectedDepth = average(seam.items.map((item) => item.top));
    insights.push({
      id: `missing:${seam.seamName}`,
      severity: "review",
      title: `Missing marker review: ${seam.seamName}`,
      detail: `${seam.seamName} is present in ${seam.presentCount} borehole(s) but missing in ${seam.missingCount}. Check whether the seam pinches out, is unlogged, or needs relabelling.`,
      evidence: seam.items.map((item) => `${item.borehole} ${item.top.toFixed(1)}-${item.bottom.toFixed(1)}m`).join(" · "),
      action: "Compare the missing borehole at the expected depth against lithology and gamma response, then add or reject the marker.",
      target:
        missingItem && expectedDepth !== null
          ? {
              boreholeId: missingItem.id,
              boreholeCode: missingItem.code,
              depth: expectedDepth,
              reason: `${seam.seamName} expected from nearby correlated tops`,
            }
          : undefined,
    });
  }

  if (variableSeams.length) {
    const seam = variableSeams[0];
    const thickest = maxBy(seam.items, (item) => item.thickness);
    insights.push({
      id: `thickness:${seam.seamName}`,
      severity: "watch",
      title: `Thickness variation: ${seam.seamName}`,
      detail: `Thickness changes from ${seam.minThickness.toFixed(2)}m to ${seam.maxThickness.toFixed(2)}m. Confirm whether this is expected seam geometry or a logging/correlation issue.`,
      evidence: seam.items.map((item) => `${item.borehole}: ${item.thickness.toFixed(2)}m`).join(" · "),
      action: "Check whether the thicker interval includes partings or merged bands before accepting the correlated seam thickness.",
      target: thickest
        ? {
            boreholeId: boreholeIdForCode(items, thickest.borehole),
            boreholeCode: thickest.borehole,
            depth: thickest.top,
            reason: `${seam.seamName} thickest picked interval`,
          }
        : undefined,
    });
  }

  if (topSpreadSeams.length) {
    const seam = topSpreadSeams[0];
    const deepestTop = maxBy(seam.items, (item) => item.top);
    insights.push({
      id: `top-spread:${seam.seamName}`,
      severity: "review",
      title: `Seam top spread: ${seam.seamName}`,
      detail: `${seam.seamName} top depth varies by ${(seam.maxTop - seam.minTop).toFixed(1)}m across selected boreholes. This may indicate dip, fault offset, naming mismatch, or local seam behavior.`,
      evidence: seam.items.map((item) => `${item.borehole}: top ${item.top.toFixed(1)}m`).join(" · "),
      action: "Review this seam in depth and RL modes, compare nearby collar positions, and save a correlation note for accepted continuity or uncertainty.",
      target: deepestTop
        ? {
            boreholeId: boreholeIdForCode(items, deepestTop.borehole),
            boreholeCode: deepestTop.borehole,
            depth: deepestTop.top,
            reason: `${seam.seamName} deepest top in selected section`,
          }
        : undefined,
    });
  }

  if (curveGaps.length) {
    insights.push({
      id: "curve-gaps",
      severity: "review",
      title: "Curve evidence is uneven",
      detail: "Some selected boreholes have limited gamma/geophysical curve support, so seam correlation confidence should be treated as lower there.",
      evidence: curveGaps.map((item) => `${item.code}: ${item.curves} curve(s)`).join(" · "),
      action: "Import LAS/PDF-derived curves or mark the correlation decision as lithology-only evidence.",
    });
  }

  const coalRich = items
    .map((item) => ({
      code: item.code,
      coalIntervals: item.lithology_intervals.filter((interval) =>
        `${interval.lithology_code ?? ""} ${interval.lithology_label}`.toLowerCase().includes("coal"),
      ).length,
    }))
    .sort((a, b) => b.coalIntervals - a.coalIntervals);
  if (coalRich.length >= 2 && coalRich[0].coalIntervals - coalRich.at(-1)!.coalIntervals >= 3) {
    insights.push({
      id: "coal-package-change",
      severity: "watch",
      title: "Coal package frequency changes",
      detail: "The number of coal/carbonaceous intervals varies noticeably across the selected boreholes.",
      evidence: coalRich.map((item) => `${item.code}: ${item.coalIntervals}`).join(" · "),
      action: "Review whether interval coding differs between boreholes before deriving seam continuity or resource-zone trends.",
    });
  }

  return insights.slice(0, 6);
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function maxBy<T>(items: T[], valueOf: (item: T) => number): T | null {
  if (!items.length) return null;
  return items.reduce((best, item) => (valueOf(item) > valueOf(best) ? item : best));
}

function boreholeIdForCode(items: BoreholeWorkbench[], code: string): number {
  return items.find((item) => item.code === code)?.id ?? 0;
}

export function correlationStats(
  items: BoreholeWorkbench[],
  seamRows: SeamCorrelationRow[],
  collarRows: CollarContextRow[],
  domain: { min: number; max: number },
  alignMode: CorrelationAlignMode,
) {
  const gammaCount = items.filter((item) => item.curves.some(isGammaCurve)).length;
  const commonSeams = seamRows.filter((row) => row.presentCount >= Math.max(2, Math.ceil(items.length * 0.6))).length;
  const distances = collarRows
    .map((row) => row.distanceFromReference)
    .filter((value): value is number => value !== null && value > 0);
  const coordinateCount = collarRows.filter((row) => row.x !== null && row.y !== null).length;
  const defaultRlCount = collarRows.filter((row) => row.rlSource === "default").length;
  return {
    boreholes: items.length,
    commonSeams,
    gammaCoverage: items.length ? `${gammaCount}/${items.length} with gamma` : "no curve evidence",
    rangeLabel:
      alignMode === "rl"
        ? `${domain.min.toFixed(0)}-${domain.max.toFixed(0)} RL`
        : `${domain.min.toFixed(0)}-${domain.max.toFixed(0)} m`,
    spatialLabel: !items.length
      ? "not evaluated"
      : coordinateCount < items.length
        ? `${coordinateCount}/${items.length} with coordinates`
        : distances.length
          ? `within ${formatDistance(Math.max(...distances))}`
          : "reference borehole",
    rlLabel: defaultRlCount
      ? `${defaultRlCount}/${items.length} estimated`
      : items.length
        ? "from supplied metadata"
        : "not evaluated",
    rlDefaulted: defaultRlCount > 0,
  };
}

export function isGammaCurve(curve: Pick<Curve, "key" | "label">): boolean {
  const key = curve.key.toLowerCase().replace(/[^a-z0-9]/g, "");
  const label = curve.label.toLowerCase();
  return ["gamma", "ngam", "ngamma", "gr"].includes(key) || label.includes("gamma");
}

export function formatCoordinatePair(row: CollarContextRow): string {
  if (row.x === null || row.y === null) return "-";
  return `${row.x.toFixed(1)}, ${row.y.toFixed(1)}`;
}

export function formatDistance(value: number | null): string {
  if (value === null) return "-";
  if (value < 1) return "reference";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${value.toFixed(0)} m`;
}
