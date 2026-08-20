import type { Curve } from "../../api/types";

const FAMILY_ORDER = [
  "gamma-ray",
  "resistivity",
  "density",
  "caliper",
  "spontaneous-potential",
  "deviation",
  "azimuth",
  "sonic",
  "bed-resolution-density",
  "neutron",
  "unmapped",
];

const FAMILY_LABELS: Record<string, string> = {
  "gamma-ray": "Gamma ray",
  resistivity: "Resistivity",
  density: "Density",
  caliper: "Caliper",
  "spontaneous-potential": "SP",
  deviation: "Deviation",
  azimuth: "Azimuth",
  sonic: "Sonic",
  "bed-resolution-density": "Bed density",
  neutron: "Neutron",
  unmapped: "Unmapped",
};

export function curveFamily(curve: Curve) {
  const family = curve.curve_metadata?.curve_family;
  return typeof family === "string" && family.trim() ? family : "unmapped";
}

export function curveFamilyLabel(curve: Curve) {
  const family = curveFamily(curve);
  return FAMILY_LABELS[family] ?? family.replaceAll("-", " ");
}

export function curveMappingStatus(curve: Curve) {
  const status = curve.curve_metadata?.mapping_status;
  return typeof status === "string" && status.trim() ? status : "unmapped";
}

export function curveMnemonic(curve: Curve) {
  const mnemonic = curve.curve_metadata?.mnemonic;
  return typeof mnemonic === "string" && mnemonic.trim() ? mnemonic : curve.key;
}

export function compareCurvesByFamily(left: Curve, right: Curve) {
  const leftRank = FAMILY_ORDER.indexOf(curveFamily(left));
  const rightRank = FAMILY_ORDER.indexOf(curveFamily(right));
  const normalizedLeftRank = leftRank === -1 ? FAMILY_ORDER.length : leftRank;
  const normalizedRightRank = rightRank === -1 ? FAMILY_ORDER.length : rightRank;
  if (normalizedLeftRank !== normalizedRightRank) return normalizedLeftRank - normalizedRightRank;
  return left.label.localeCompare(right.label);
}
