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

const FAMILY_BY_LEGACY_KEY: Record<string, string> = {
  gamma: "gamma-ray",
  ngam: "gamma-ray",
  ngamma: "gamma-ray",
  gr: "gamma-ray",
  resistivity: "resistivity",
  res: "resistivity",
  rs: "resistivity",
  spr: "resistivity",
  density: "density",
  dens: "density",
  rhob: "density",
  caliper: "caliper",
  calp: "caliper",
  calp_incl: "caliper",
  sp: "spontaneous-potential",
  inclination: "deviation",
  incl: "deviation",
  azimuth: "azimuth",
  az: "azimuth",
};

const MNEMONIC_BY_LEGACY_KEY: Record<string, string> = {
  gamma: "GR",
  ngam: "NGAM",
  ngamma: "NGAM",
  res: "RES",
  spr: "SPR",
  dens: "DENS",
  calp: "CALP",
  calp_incl: "CALP/INCL",
  sp: "SP",
};

export function curveFamily(curve: Curve) {
  const family = curve.curve_metadata?.curve_family;
  if (typeof family === "string" && family.trim()) return family;
  return FAMILY_BY_LEGACY_KEY[curve.key.toLowerCase()] ?? familyFromLabel(curve.label);
}

export function curveFamilyLabel(curve: Curve) {
  const family = curveFamily(curve);
  return FAMILY_LABELS[family] ?? family.replaceAll("-", " ");
}

export function curveMappingStatus(curve: Curve) {
  const status = curve.curve_metadata?.mapping_status;
  if (typeof status === "string" && status.trim()) return status;
  return curveFamily(curve) === "unmapped" ? "unmapped" : "mapped-by-key";
}

export function curveMnemonic(curve: Curve) {
  const mnemonic = curve.curve_metadata?.mnemonic;
  if (typeof mnemonic === "string" && mnemonic.trim()) return mnemonic;
  return MNEMONIC_BY_LEGACY_KEY[curve.key.toLowerCase()] ?? curve.key;
}

export function compareCurvesByFamily(left: Curve, right: Curve) {
  const leftRank = FAMILY_ORDER.indexOf(curveFamily(left));
  const rightRank = FAMILY_ORDER.indexOf(curveFamily(right));
  const normalizedLeftRank = leftRank === -1 ? FAMILY_ORDER.length : leftRank;
  const normalizedRightRank = rightRank === -1 ? FAMILY_ORDER.length : rightRank;
  if (normalizedLeftRank !== normalizedRightRank) return normalizedLeftRank - normalizedRightRank;
  return left.label.localeCompare(right.label);
}

function familyFromLabel(label: string) {
  const text = label.toLowerCase();
  if (text.includes("gamma")) return "gamma-ray";
  if (text.includes("resist")) return "resistivity";
  if (text.includes("dens")) return "density";
  if (text.includes("caliper")) return "caliper";
  if (text.includes("spontaneous")) return "spontaneous-potential";
  if (text.includes("incl")) return "deviation";
  if (text.includes("azimuth")) return "azimuth";
  return "unmapped";
}
