import type { LithologyInterval } from "../../api/types";

export type LithologyPattern = {
  code: string;
  label: string;
  className: string;
  color: string;
  aliases: string[];
  keywords: string[];
};

const PATTERNS: LithologyPattern[] = [
  pattern("COAL", "Coal", "pattern-coal", "#111827", ["C", "CL", "CO", "COAL"], ["coal"]),
  pattern("SHCOAL", "Shaly coal", "pattern-shaly-coal", "#1f2933", ["SHCOAL", "COALYSH", "COALY-SH"], ["shaly coal", "coaly shale"]),
  pattern("CARBSHL", "Carbonaceous shale", "pattern-carbonaceous", "#394047", ["CARBSHL", "CSH", "C-SH", "CARB-SH"], ["carbonaceous shale", "carb shale"]),
  pattern("CARBCLAY", "Carbonaceous clay", "pattern-carbonaceous-clay", "#4b5563", ["CARBCLAY", "C-CLAY"], ["carbonaceous clay"]),
  pattern("SH", "Shale", "pattern-shale", "#59666c", ["SH", "SHALE", "SHL"], ["shale"]),
  pattern("CLAY", "Claystone", "pattern-clay", "#8ca0a6", ["CLAY", "CLAYSTONE", "CL"], ["clay", "claystone"]),
  pattern("MUD", "Mudstone", "pattern-mudstone", "#7b6d64", ["MUD", "MUDSTONE", "MST"], ["mudstone", "mud"]),
  pattern("SS", "Sandstone", "pattern-sandstone", "#d4a257", ["SS", "SST", "SANDSTONE", "SSMTCG"], ["sandstone", "sand stone", "sand"]),
  pattern("SLT", "Siltstone", "pattern-siltstone", "#b8a77a", ["SLT", "SILT", "SILTSTONE"], ["siltstone", "silt"]),
  pattern("LST", "Limestone", "pattern-limestone", "#9ab0b7", ["LS", "LST", "LIME", "LIMESTONE"], ["limestone", "lime stone", "calcareous"]),
  pattern("CONG", "Conglomerate", "pattern-conglomerate", "#b88752", ["CONG", "CONGLOMERATE", "CG"], ["conglomerate", "pebble", "gravel"]),
  pattern("OB", "Overburden", "pattern-overburden", "#c6b18a", ["OB", "OVERBURDEN", "SOIL"], ["overburden", "soil", "alluvium"]),
  pattern("LATERITE", "Laterite", "pattern-laterite", "#b95f3b", ["LAT", "LATERITE"], ["laterite", "lateritic"]),
];

function pattern(
  code: string,
  label: string,
  className: string,
  color: string,
  aliases: string[],
  keywords: string[],
): LithologyPattern {
  return {
    code,
    label,
    className,
    color,
    aliases: aliases.map(normalize),
    keywords: keywords.map(normalize),
  };
}

export function lithologyPattern(
  code: string | null | undefined,
  label?: string | null | undefined,
): LithologyPattern {
  const normalized = normalize(code);
  const normalizedLabel = normalize(label);
  return (
    PATTERNS.find((pattern) => pattern.code === normalized || pattern.aliases.includes(normalized)) ??
    bestKeywordPattern(normalizedLabel) ?? {
      code: normalized || "UNK",
      label: label || normalized || "Unknown",
      className: "pattern-default",
      color: "#64748b",
      aliases: [],
      keywords: [],
    }
  );
}

export function legendForIntervals(intervals: LithologyInterval[]): LithologyPattern[] {
  const seen = new Set<string>();
  const legend: LithologyPattern[] = [];
  for (const interval of intervals) {
    const pattern = lithologyPattern(interval.lithology_code, interval.lithology_label);
    if (seen.has(pattern.code)) continue;
    seen.add(pattern.code);
    legend.push(pattern);
  }
  return legend.slice(0, 8);
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function bestKeywordPattern(normalizedLabel: string): LithologyPattern | null {
  let best: { pattern: LithologyPattern; keywordLength: number } | null = null;
  for (const pattern of PATTERNS) {
    for (const keyword of pattern.keywords) {
      if (!normalizedLabel.includes(keyword)) continue;
      if (!best || keyword.length > best.keywordLength) {
        best = { pattern, keywordLength: keyword.length };
      }
    }
  }
  return best?.pattern ?? null;
}
