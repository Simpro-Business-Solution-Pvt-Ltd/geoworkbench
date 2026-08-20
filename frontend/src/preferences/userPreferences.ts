export type UnitSystem = "metric" | "mining_metric" | "imperial" | "custom";
export type DepthUnit = "m" | "ft";
export type LengthUnit = "m" | "cm" | "mm" | "ft" | "in";
export type CoordinateUnit = "m" | "ft";
export type DensityUnit = "g/cc" | "kg/m3";

export type UserPreferences = {
  unitSystem: UnitSystem;
  depthUnit: DepthUnit;
  lengthUnit: LengthUnit;
  coordinateUnit: CoordinateUnit;
  densityUnit: DensityUnit;
  timezone: string;
  dateFormat: "locale" | "iso";
  numberFormat: "en-IN" | "en-US";
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  unitSystem: "mining_metric",
  depthUnit: "m",
  lengthUnit: "m",
  coordinateUnit: "m",
  densityUnit: "g/cc",
  timezone: "Asia/Kolkata",
  dateFormat: "locale",
  numberFormat: "en-IN",
};

export function normalizeUserPreferences(value: Partial<UserPreferences> | null | undefined): UserPreferences {
  return {
    ...DEFAULT_USER_PREFERENCES,
    ...(value ?? {}),
  };
}

export function formatNumber(value: number, preferences: UserPreferences, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(preferences.numberFormat, {
    maximumFractionDigits,
  }).format(value);
}

export function formatDateTimeWithPreferences(value: string | null | undefined, preferences: UserPreferences): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  if (preferences.dateFormat === "iso") {
    return date.toISOString();
  }
  return date.toLocaleString(preferences.numberFormat, { timeZone: preferences.timezone });
}

export function formatDepth(valueMeters: number | null | undefined, preferences: UserPreferences) {
  if (typeof valueMeters !== "number" || !Number.isFinite(valueMeters)) return "-";
  if (preferences.depthUnit === "ft") {
    return `${formatNumber(valueMeters * 3.280839895, preferences, 2)} ft`;
  }
  return `${formatNumber(valueMeters, preferences, 2)} m`;
}

export function formatMeasurement(
  value: number | null | undefined,
  sourceUnit: string | null | undefined,
  targetUnit: string | null | undefined,
  preferences: UserPreferences,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  const converted = convertMeasurement(value, sourceUnit, targetUnit);
  return `${formatNumber(converted.value, preferences, 2)} ${converted.unit}`;
}

export function convertMeasurement(value: number, sourceUnit: string | null | undefined, targetUnit: string | null | undefined) {
  const source = normalizeUnit(sourceUnit);
  const target = normalizeUnit(targetUnit) || source;
  if (!source || !target || source === target) return { value, unit: source || target || "" };
  if (source === "m" && target === "ft") return { value: value * 3.280839895, unit: "ft" };
  if (source === "ft" && target === "m") return { value: value / 3.280839895, unit: "m" };
  if (source === "cm" && target === "in") return { value: value / 2.54, unit: "in" };
  if (source === "in" && target === "cm") return { value: value * 2.54, unit: "cm" };
  if (source === "g/cc" && target === "kg/m3") return { value: value * 1000, unit: "kg/m3" };
  if (source === "kg/m3" && target === "g/cc") return { value: value / 1000, unit: "g/cc" };
  return { value, unit: sourceUnit || targetUnit || "" };
}

function normalizeUnit(unit: string | null | undefined) {
  const value = String(unit ?? "").trim().toLowerCase();
  if (!value) return "";
  if (["meter", "metre", "meters", "metres"].includes(value)) return "m";
  if (["feet", "foot"].includes(value)) return "ft";
  if (["inch", "inches"].includes(value)) return "in";
  if (["g/cc", "gm/cc", "g/cm3", "g/cm^3"].includes(value)) return "g/cc";
  if (["kg/m3", "kg/m^3"].includes(value)) return "kg/m3";
  return value;
}
