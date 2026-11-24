import type { ExportSourceField } from "../../api/types";

export type ExportColumn = {
  source: string;
  target: string;
};

export const LITHOLOGY_EXPORT_TYPES = ["corrected_lithology_xlsx", "corrected_lithology_csv"];

export const CURVE_EXPORT_TYPES = ["curves_las", "curves_csv"];

export const ATTRIBUTE_PREFIX = "lithology.attributes.";

export function isLithologyExportType(exportType: string): boolean {
  return LITHOLOGY_EXPORT_TYPES.includes(exportType);
}

export function isCurveExportType(exportType: string): boolean {
  return CURVE_EXPORT_TYPES.includes(exportType);
}

export function exportColumnsFromMapping(
  mapping: Record<string, unknown> | null | undefined,
): ExportColumn[] {
  const columns = mapping?.columns;
  if (!Array.isArray(columns)) return [];
  const result: ExportColumn[] = [];
  for (const item of columns) {
    if (typeof item === "string") {
      const source = item.trim();
      if (source) result.push({ source, target: source });
    } else if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const source = String(record.source ?? record.key ?? "").trim();
      const target = String(record.target ?? record.label ?? source).trim();
      if (source) result.push({ source, target });
    }
  }
  return result;
}

export function exportCurveKeysFromMapping(
  mapping: Record<string, unknown> | null | undefined,
): string[] {
  const curves = mapping?.curves;
  if (!Array.isArray(curves)) return [];
  return curves.map((item) => String(item).trim()).filter(Boolean);
}

export function curvesMappingForType(exportType: string, curves: Array<{ key: string }>): string[] {
  if (!isCurveExportType(exportType)) return [];
  return curves.map((curve) => curve.key);
}

export function exportMappingFromState(
  exportType: string,
  baseMapping: Record<string, unknown> | null | undefined,
  columns: ExportColumn[],
  curveKeys: string[],
): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(baseMapping ?? {})) {
    if (key === "columns" || key === "curves" || key === "version") continue;
    base[key] = value;
  }
  if (isLithologyExportType(exportType)) base.columns = columns;
  if (isCurveExportType(exportType)) base.curves = curveKeys;
  return base;
}

export function defaultExportColumns(sourceFields: ExportSourceField[]): ExportColumn[] {
  const labelFor = new Map(sourceFields.map((field) => [field.key, field.label]));
  const standard = [
    "borehole.code",
    "lithology.source_row",
    "lithology.from_depth",
    "lithology.to_depth",
    "lithology.thickness",
    "lithology.lithology_code",
    "lithology.lithology_label",
    "lithology.seam_name",
    "lithology.recovery_percent",
    "lithology.rqd_percent",
    "lithology.structural_features",
    "lithology.remark",
  ];
  return standard
    .filter((key) => labelFor.has(key))
    .map((key) => ({ source: key, target: labelFor.get(key)! }));
}

export function groupExportSourceFields(sourceFields: ExportSourceField[]): Array<{ group: string; fields: ExportSourceField[] }> {
  const groups = new Map<string, ExportSourceField[]>();
  for (const field of sourceFields) {
    const group = field.group ?? "Other";
    groups.set(group, [...(groups.get(group) ?? []), field]);
  }
  return [...groups.entries()].map(([group, fields]) => ({ group, fields }));
}

export function exportTemplateErrors(args: {
  name: string;
  exportType: string;
  columns: ExportColumn[];
  sourceFields: ExportSourceField[];
}): string[] {
  const errors: string[] = [];
  if (!args.name.trim()) errors.push("Enter a template name.");
  if (!isLithologyExportType(args.exportType) && !isCurveExportType(args.exportType)) {
    errors.push("This export format has no visual template editor.");
    return errors;
  }
  if (isLithologyExportType(args.exportType)) {
    if (args.columns.length === 0) errors.push("Add at least one output column.");
    const known = new Set(args.sourceFields.map((field) => field.key));
    const seenTargets = new Set<string>();
    args.columns.forEach((column, index) => {
      const label = `Column ${index + 1}`;
      const source = column.source.trim();
      const target = column.target.trim();
      if (!source) {
        errors.push(`${label}: choose a source field.`);
      } else if (!source.startsWith(ATTRIBUTE_PREFIX) && !known.has(source)) {
        errors.push(`${label}: "${source}" is not an exportable field.`);
      }
      if (!target) {
        errors.push(`${label}: give the output column a name.`);
      } else if (seenTargets.has(target)) {
        errors.push(`${label}: output name "${target}" is used more than once.`);
      } else {
        seenTargets.add(target);
      }
    });
  }
  return errors;
}
