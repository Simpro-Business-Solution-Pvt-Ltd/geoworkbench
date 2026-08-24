import type { BoreholeWorkbench } from "../../../api/types";

export type EvidenceCoverageStatus = "available" | "partial" | "missing" | "review";

export type EvidenceCoverageItem = {
  id: string;
  label: string;
  status: EvidenceCoverageStatus;
  value: string;
  detail: string;
};

export function buildEvidenceCoverage(data: BoreholeWorkbench): EvidenceCoverageItem[] {
  const curveCoverage = curveCoverageSummary(data);
  const correctionCoverage = correctionCoverageSummary(data);
  const coordinates = collarCoordinateSummary(data);
  const openIssues = data.validation_issues.filter((issue) => !["resolved", "accepted", "rejected"].includes(issue.status));

  return [
    {
      id: "lithology",
      label: "Lithology",
      status: data.lithology_intervals.length ? "available" : "missing",
      value: `${data.lithology_intervals.length} intervals`,
      detail: data.lithology_intervals.length ? "Depth log available for review and correction." : "No interpreted intervals loaded.",
    },
    {
      id: "seams",
      label: "Seams",
      status: data.seam_intervals.length ? "available" : "review",
      value: `${data.seam_intervals.length} markers`,
      detail: data.seam_intervals.length ? "Seam evidence is ready for correlation." : "Correlation may need seam names or marker intervals.",
    },
    {
      id: "curves",
      label: "Curves",
      status: curveCoverage.status,
      value: curveCoverage.value,
      detail: curveCoverage.detail,
    },
    {
      id: "core-images",
      label: "Core images",
      status: data.core_images.length ? "available" : "missing",
      value: data.core_images.length ? `${data.core_images.length} linked` : "not supplied",
      detail: data.core_images.length
        ? "Core image records are linked to this borehole."
        : "Image track will show a missing package state until images are supplied.",
    },
    {
      id: "collar",
      label: "Collar",
      status: coordinates.status,
      value: coordinates.value,
      detail: coordinates.detail,
    },
    {
      id: "corrections",
      label: "Corrections",
      status: correctionCoverage.status,
      value: correctionCoverage.value,
      detail: correctionCoverage.detail,
    },
    {
      id: "source-audit",
      label: "Source audit",
      status: data.source_imports.length || data.source_files.length ? "available" : "review",
      value: `${data.source_imports.length} imports / ${data.source_files.length} files`,
      detail: data.source_imports.length || data.source_files.length
        ? "Source provenance is available for audit."
        : "No source queue or parsed import evidence is attached.",
    },
    {
      id: "validation",
      label: "Validation",
      status: openIssues.length ? "review" : "available",
      value: openIssues.length ? `${openIssues.length} open` : "clear",
      detail: openIssues.length ? "Open rules/quality findings need review." : "No open validation findings.",
    },
  ];
}

function curveCoverageSummary(data: BoreholeWorkbench): Pick<EvidenceCoverageItem, "status" | "value" | "detail"> {
  if (!data.curves.length) {
    return {
      status: "missing",
      value: "0 curves",
      detail: "No LAS/geophysical curve evidence is attached.",
    };
  }
  const depths = data.curves.flatMap((curve) => curve.samples.map((sample) => sample.depth));
  if (!depths.length || data.total_depth <= 0) {
    return {
      status: "review",
      value: `${data.curves.length} curves`,
      detail: "Curve headers are present, but sample coverage is not available.",
    };
  }
  const fromDepth = Math.min(...depths);
  const toDepth = Math.max(...depths);
  const percent = Math.max(0, Math.min(100, ((toDepth - fromDepth) / data.total_depth) * 100));
  return {
    status: percent >= 80 ? "available" : "partial",
    value: `${data.curves.length} curves · ${percent.toFixed(0)}%`,
    detail: `${fromDepth.toFixed(1)}-${toDepth.toFixed(1)}m curve coverage.`,
  };
}

function correctionCoverageSummary(data: BoreholeWorkbench): Pick<EvidenceCoverageItem, "status" | "value" | "detail"> {
  const staged = data.lithology_intervals.filter((interval) => typeof interval.attributes?.data_stage === "string");
  if (!staged.length) {
    return {
      status: data.correction_audits?.length ? "partial" : "review",
      value: data.correction_audits?.length ? `${data.correction_audits.length} audit rows` : "unstaged",
      detail: data.correction_audits?.length
        ? "Correction audit exists, but interval stages are incomplete."
        : "Raw/corrected stage metadata is not available for intervals.",
    };
  }
  const corrected = staged.filter((interval) =>
    ["geologist_corrected", "approved_final"].includes(String(interval.attributes?.data_stage)),
  );
  const percent = (corrected.length / staged.length) * 100;
  return {
    status: percent >= 100 ? "available" : percent > 0 ? "partial" : "review",
    value: `${percent.toFixed(0)}%`,
    detail: `${corrected.length}/${staged.length} staged intervals are corrected or approved.`,
  };
}

function collarCoordinateSummary(data: BoreholeWorkbench): Pick<EvidenceCoverageItem, "status" | "value" | "detail"> {
  const collar = objectValue(objectValue(data.attributes).collar);
  const hasCoalgrid = hasNumber(collar, "coalgrid_easting") && hasNumber(collar, "coalgrid_northing");
  const hasUtm = hasNumber(collar, "utm_easting") && hasNumber(collar, "utm_northing");
  if (hasCoalgrid || hasUtm) {
    return {
      status: "available",
      value: hasCoalgrid ? "coalgrid" : "UTM",
      detail: "Coordinates are available for spatial/correlation context.",
    };
  }
  return {
    status: "missing",
    value: "missing",
    detail: "Coordinates are needed for reliable spatial correlation.",
  };
}

function hasNumber(source: Record<string, unknown>, key: string) {
  return typeof source[key] === "number" && Number.isFinite(source[key]);
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
