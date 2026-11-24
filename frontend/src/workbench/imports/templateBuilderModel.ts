// Form model for "tabular_intervals" import templates (Template Registry builder).
// The backend validates the same shape in app/services/template_import.py.

export const TEMPLATE_KIND = "tabular_intervals";

export type FieldKey =
  | "lithology"
  | "logged_color"
  | "structural_features"
  | "recovery"
  | "recovery_percent"
  | "rqd"
  | "seam_name"
  | "grain_size"
  | "core_dip";

export type NormalizeRule = "none" | "upper" | "zero_pad_number:2" | "zero_pad_number:3";

export type TemplateBuilderState = {
  sheet: string;
  headerRow: number;
  dataStartRow: number;
  depthMode: "to" | "thickness";
  depthFrom: string;
  depthTo: string;
  depthThickness: string;
  fields: Record<FieldKey, string>;
  remarkColumns: string[];
  boreholeSource: "column" | "selected";
  boreholeColumn: string;
  normalize: NormalizeRule;
  rqdUnit: "percent" | "fraction";
  stopAfterBlankRows: number;
};

export const FIELD_DEFS: Array<{ key: FieldKey; label: string; required?: boolean }> = [
  { key: "lithology", label: "Lithology", required: true },
  { key: "logged_color", label: "Logged colour" },
  { key: "structural_features", label: "Structural features" },
  { key: "recovery", label: "Recovery (m)" },
  { key: "recovery_percent", label: "Recovery %" },
  { key: "rqd", label: "RQD" },
  { key: "seam_name", label: "Seam name" },
  { key: "grain_size", label: "Grain size" },
  { key: "core_dip", label: "Core dip" },
];

export const NORMALIZE_OPTIONS: Array<{ value: NormalizeRule; label: string }> = [
  { value: "none", label: "As written" },
  { value: "upper", label: "Upper-case only" },
  { value: "zero_pad_number:2", label: "Pad number to 2 digits (MGCA-8 → MGCA-08)" },
  { value: "zero_pad_number:3", label: "Pad number to 3 digits (BH-8 → BH-008)" },
];

const NORMALIZE_VALUES = NORMALIZE_OPTIONS.map((item) => item.value);

export function emptyBuilderState(): TemplateBuilderState {
  return {
    sheet: "first",
    headerRow: 1,
    dataStartRow: 2,
    depthMode: "to",
    depthFrom: "",
    depthTo: "",
    depthThickness: "",
    fields: {
      lithology: "",
      logged_color: "",
      structural_features: "",
      recovery: "",
      recovery_percent: "",
      rqd: "",
      seam_name: "",
      grain_size: "",
      core_dip: "",
    },
    remarkColumns: [],
    boreholeSource: "selected",
    boreholeColumn: "",
    normalize: "none",
    rqdUnit: "percent",
    stopAfterBlankRows: 3,
  };
}

// ----------------------------------------------------------------------------- state <-> JSON

export function requiredHeaders(state: TemplateBuilderState): string[] {
  const refs = [
    state.boreholeSource === "column" ? state.boreholeColumn : "",
    state.depthFrom,
    state.depthMode === "to" ? state.depthTo : state.depthThickness,
    state.fields.lithology,
  ];
  return refs.map((ref) => ref.trim()).filter(Boolean);
}

export function builderStateToMapping(state: TemplateBuilderState): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const { key } of FIELD_DEFS) {
    const value = state.fields[key].trim();
    if (value) fields[key] = value;
  }
  const remarks = state.remarkColumns.map((item) => item.trim()).filter(Boolean);
  if (remarks.length === 1) fields.remark = remarks[0];
  if (remarks.length > 1) fields.remark = remarks;

  return {
    kind: TEMPLATE_KIND,
    detect: { sheet: state.sheet.trim() || "first", required_headers: requiredHeaders(state) },
    header_row: state.headerRow,
    data_start_row: state.dataStartRow,
    borehole:
      state.boreholeSource === "column"
        ? { source: "column", column: state.boreholeColumn.trim(), normalize: state.normalize }
        : { source: "selected", normalize: state.normalize },
    depth:
      state.depthMode === "to"
        ? { from: state.depthFrom.trim(), to: state.depthTo.trim() }
        : { from: state.depthFrom.trim(), thickness: state.depthThickness.trim() },
    fields,
    units: { rqd: state.rqdUnit },
    end: { stop_after_blank_rows: state.stopAfterBlankRows },
  };
}

export function mappingToBuilderState(mapping: Record<string, unknown> | null | undefined): TemplateBuilderState {
  const state = emptyBuilderState();
  if (!mapping) return state;
  const detect = record(mapping.detect);
  const depth = record(mapping.depth);
  const fields = record(mapping.fields);
  const borehole = record(mapping.borehole);
  const units = record(mapping.units);
  const end = record(mapping.end);

  state.sheet = text(detect.sheet) || "first";
  state.headerRow = positiveInt(mapping.header_row, 1);
  state.dataStartRow = positiveInt(mapping.data_start_row, state.headerRow + 1);
  state.depthFrom = text(depth.from);
  if (text(depth.thickness) && !text(depth.to)) {
    state.depthMode = "thickness";
    state.depthThickness = text(depth.thickness);
  } else {
    state.depthTo = text(depth.to);
  }
  for (const { key } of FIELD_DEFS) state.fields[key] = text(fields[key]);
  state.remarkColumns = Array.isArray(fields.remark)
    ? fields.remark.map(text).filter(Boolean)
    : text(fields.remark)
      ? [text(fields.remark)]
      : [];
  state.boreholeSource = borehole.source === "column" ? "column" : "selected";
  state.boreholeColumn = text(borehole.column);
  const normalize = text(borehole.normalize) as NormalizeRule;
  state.normalize = NORMALIZE_VALUES.includes(normalize) ? normalize : "none";
  state.rqdUnit = units.rqd === "fraction" ? "fraction" : "percent";
  state.stopAfterBlankRows = positiveInt(end.stop_after_blank_rows, 3);
  return state;
}

/** Client-side checks that mirror the backend, so the form can explain problems before saving. */
export function builderErrors(state: TemplateBuilderState): string[] {
  const errors: string[] = [];
  if (state.headerRow < 1) errors.push("Header row must be 1 or more.");
  if (state.dataStartRow <= state.headerRow) errors.push("Data must start after the header row.");
  if (!state.depthFrom.trim()) errors.push("Choose the From-depth column.");
  if (state.depthMode === "to" && !state.depthTo.trim()) errors.push("Choose the To-depth column.");
  if (state.depthMode === "thickness" && !state.depthThickness.trim()) errors.push("Choose the thickness column.");
  if (!state.fields.lithology.trim()) errors.push("Choose the lithology column.");
  if (state.boreholeSource === "column" && !state.boreholeColumn.trim()) {
    errors.push("Choose the borehole-code column, or switch to “one borehole per file”.");
  }
  return errors;
}

// ----------------------------------------------------------------------------- sample helpers

export function headersFromRow(rows: Array<Array<unknown>>, headerRow: number): string[] {
  const row = rows[headerRow - 1] ?? [];
  return row.map((value) => (value === null || value === undefined ? "" : String(value).trim())).filter(Boolean);
}

const SYNONYMS: Record<string, string[]> = {
  borehole: ["borehole no", "borehole", "bh no", "bh", "hole id", "borehole id", "well"],
  depthFrom: ["from", "depth from", "from depth", "top"],
  depthTo: ["to", "depth to", "to depth", "bottom", "base"],
  depthThickness: ["thickness", "total length", "length"],
  lithology: ["lithology", "rock type", "litho", "lithology description"],
  recovery_percent: ["recovery %", "recovery percent", "rec %", "core recovery %"],
  recovery: ["recovery thickness", "recovery m", "recovery"],
  seam_name: ["seam name", "seam"],
  logged_color: ["colour", "color", "logged colour", "logged color"],
  structural_features: ["structural features", "features", "structure"],
  rqd: ["rqd", "rqd %"],
  grain_size: ["grain size"],
  core_dip: ["core dip", "dip"],
  remark: ["remarks", "remark", "other details", "comments", "formation"],
};

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/** 3 = same words, 2 = header starts with the synonym's words, 1 = contains them, 0 = no match. */
function matchScore(header: string, synonym: string): number {
  const headerTokens = tokens(header).filter((token) => token !== "m");
  const synonymTokens = tokens(synonym);
  if (!synonymTokens.length || !headerTokens.length) return 0;
  if (headerTokens.join(" ") === synonymTokens.join(" ")) return 3;
  for (let start = 0; start + synonymTokens.length <= headerTokens.length; start += 1) {
    if (synonymTokens.every((token, offset) => headerTokens[start + offset] === token)) {
      return start === 0 ? 2 : 1;
    }
  }
  return 0;
}

function bestHeader(headers: string[], role: string, used: Set<string>): string {
  let best = "";
  let bestScore = 0;
  for (const header of headers) {
    if (used.has(header)) continue;
    for (const synonym of SYNONYMS[role]) {
      const score = matchScore(header, synonym);
      if (score > bestScore) {
        best = header;
        bestScore = score;
      }
    }
  }
  if (best) used.add(best);
  return best;
}

/** Pre-fill a builder state from a sample's header row. The user reviews every choice. */
export function suggestMapping(headers: string[], base: TemplateBuilderState): TemplateBuilderState {
  const used = new Set<string>();
  const next: TemplateBuilderState = { ...base, fields: { ...base.fields } };

  next.boreholeColumn = bestHeader(headers, "borehole", used);
  next.boreholeSource = next.boreholeColumn ? "column" : "selected";
  next.depthFrom = bestHeader(headers, "depthFrom", used);
  next.depthTo = bestHeader(headers, "depthTo", used);
  if (next.depthTo) {
    next.depthMode = "to";
    next.depthThickness = "";
  } else {
    next.depthThickness = bestHeader(headers, "depthThickness", used);
    next.depthMode = next.depthThickness ? "thickness" : "to";
  }
  next.fields.lithology = bestHeader(headers, "lithology", used);
  next.fields.recovery_percent = bestHeader(headers, "recovery_percent", used);
  next.fields.recovery = bestHeader(headers, "recovery", used);
  next.fields.seam_name = bestHeader(headers, "seam_name", used);
  next.fields.logged_color = bestHeader(headers, "logged_color", used);
  next.fields.structural_features = bestHeader(headers, "structural_features", used);
  next.fields.rqd = bestHeader(headers, "rqd", used);
  next.fields.grain_size = bestHeader(headers, "grain_size", used);
  next.fields.core_dip = bestHeader(headers, "core_dip", used);

  const remarks: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    const header = bestHeader(headers, "remark", used);
    if (header) remarks.push(header);
  }
  next.remarkColumns = remarks;
  return next;
}

// ----------------------------------------------------------------------------- utils

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}
