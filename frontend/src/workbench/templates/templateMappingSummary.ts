export type TemplateMappingRow = {
  source: string;
  target: string;
  detail?: string;
};

const MAX_MAPPING_ROWS = 32;
const SOURCE_KEYS = ["source", "key", "from", "field", "column", "mnemonic", "curve"];
const TARGET_KEYS = ["target", "label", "to", "canonical", "model", "name"];

export function safeMappingFromText(mappingText: string): Record<string, unknown> | null {
  try {
    const mapping = JSON.parse(mappingText);
    return isRecord(mapping) ? mapping : null;
  } catch {
    return null;
  }
}

export function mappingRowsFromTemplate(
  mapping: Record<string, unknown> | null | undefined,
): TemplateMappingRow[] {
  if (!mapping) return [];
  const rows: TemplateMappingRow[] = [];

  appendColumnRows(rows, mapping.columns);
  appendPrimitiveRow(rows, mapping.depth, "depth");
  appendPrimitiveRow(rows, mapping.depth_column, "depth_column");
  appendArrayRows(rows, mapping.curves, "curves");
  appendDictionaryRows(rows, mapping.curve_dictionary, "curve_dictionary");
  appendNestedMappingRows(rows, mapping, []);

  return dedupeRows(rows).slice(0, MAX_MAPPING_ROWS);
}

function appendColumnRows(rows: TemplateMappingRow[], value: unknown) {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (typeof item === "string") {
      rows.push({ source: item, target: item, detail: "column" });
      return;
    }
    if (!isRecord(item)) return;
    const source = firstString(item, SOURCE_KEYS);
    const target = firstString(item, TARGET_KEYS);
    if (source || target) {
      rows.push({ source: source || "(source)", target: target || "(target)", detail: "column" });
    }
  });
}

function appendPrimitiveRow(rows: TemplateMappingRow[], value: unknown, target: string) {
  if (typeof value === "string" || typeof value === "number") {
    rows.push({ source: String(value), target });
  }
}

function appendArrayRows(rows: TemplateMappingRow[], value: unknown, target: string) {
  if (!Array.isArray(value)) return;
  value.forEach((item) => {
    if (typeof item === "string" || typeof item === "number") {
      rows.push({ source: String(item), target });
    }
  });
}

function appendDictionaryRows(rows: TemplateMappingRow[], value: unknown, path: string) {
  if (!isRecord(value)) return;
  Object.entries(value).forEach(([target, source]) => {
    if (Array.isArray(source)) {
      source.forEach((item) => {
        if (typeof item === "string" || typeof item === "number") {
          rows.push({ source: String(item), target: `${path}.${target}`, detail: "curve dictionary" });
        }
      });
      return;
    }
    if (typeof source === "string" || typeof source === "number") {
      rows.push({ source: String(source), target: `${path}.${target}`, detail: "dictionary" });
    }
  });
}

function appendNestedMappingRows(rows: TemplateMappingRow[], value: unknown, path: string[]) {
  if (!isRecord(value) || rows.length >= MAX_MAPPING_ROWS) return;

  Object.entries(value).forEach(([key, child]) => {
    if (["columns", "curve_dictionary"].includes(key)) return;
    const nextPath = [...path, key];
    if (isRecord(child)) {
      appendStructuredRow(rows, child, nextPath);
      appendNestedMappingRows(rows, child, nextPath);
      return;
    }
    if (Array.isArray(child)) {
      child.forEach((item) => appendNestedArrayItem(rows, item, nextPath.join(".")));
      return;
    }
    if (typeof child === "string" || typeof child === "number" || typeof child === "boolean") {
      rows.push({ source: String(child), target: nextPath.join(".") });
    }
  });
}

function appendStructuredRow(rows: TemplateMappingRow[], value: Record<string, unknown>, path: string[]) {
  const source = firstString(value, SOURCE_KEYS);
  const target = firstString(value, TARGET_KEYS);
  if (!source && !target) return;
  rows.push({
    source: source || path.join("."),
    target: target || path.join("."),
    detail: path.join("."),
  });
}

function appendNestedArrayItem(rows: TemplateMappingRow[], item: unknown, target: string) {
  if (typeof item === "string" || typeof item === "number") {
    rows.push({ source: String(item), target });
    return;
  }
  if (!isRecord(item)) return;
  const source = firstString(item, SOURCE_KEYS);
  const mappedTarget = firstString(item, TARGET_KEYS) || target;
  if (source || mappedTarget) {
    rows.push({ source: source || target, target: mappedTarget });
  }
}

function firstString(source: Record<string, unknown>, keys: string[]) {
  const value = keys.map((key) => source[key]).find((item) => typeof item === "string" || typeof item === "number");
  return value === undefined ? "" : String(value);
}

function dedupeRows(rows: TemplateMappingRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.source}:${row.target}:${row.detail ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
