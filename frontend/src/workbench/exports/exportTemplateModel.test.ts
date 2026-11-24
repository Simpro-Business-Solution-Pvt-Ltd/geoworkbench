import { describe, expect, it } from "vitest";

import type { ExportSourceField } from "../../api/types";
import {
  exportColumnsFromMapping,
  exportCurveKeysFromMapping,
  exportMappingFromState,
  exportTemplateErrors,
  defaultExportColumns,
  groupExportSourceFields,
} from "./exportTemplateModel";

const SOURCE_FIELDS: ExportSourceField[] = [
  { key: "borehole.code", label: "Borehole code", unit: null, group: "Borehole" },
  { key: "lithology.from_depth", label: "From depth", unit: "m", group: "Depth" },
  { key: "lithology.to_depth", label: "To depth", unit: "m", group: "Depth" },
  { key: "lithology.lithology_code", label: "Lithology code", unit: null, group: "Lithology" },
  { key: "lithology.remark", label: "Remarks", unit: null, group: "Observations" },
];

describe("exportColumnsFromMapping", () => {
  it("reads legacy string columns as source= target pairs", () => {
    expect(exportColumnsFromMapping({ columns: ["Borehole", "From depth"] })).toEqual([
      { source: "Borehole", target: "Borehole" },
      { source: "From depth", target: "From depth" },
    ]);
  });

  it("reads object columns and falls back to source for the target name", () => {
    const columns = exportColumnsFromMapping({
      columns: [
        { source: "lithology.from_depth", target: "Top (m)" },
        { source: "lithology.to_depth" },
      ],
    });
    expect(columns).toEqual([
      { source: "lithology.from_depth", target: "Top (m)" },
      { source: "lithology.to_depth", target: "lithology.to_depth" },
    ]);
  });

  it("returns [] for missing or malformed mappings", () => {
    expect(exportColumnsFromMapping(null)).toEqual([]);
    expect(exportColumnsFromMapping({})).toEqual([]);
    expect(exportColumnsFromMapping({ columns: "nope" })).toEqual([]);
  });
});

describe("exportCurveKeysFromMapping", () => {
  it("returns trimmed, non-empty curve keys", () => {
    expect(exportCurveKeysFromMapping({ curves: [" GR ", "", "SP"] })).toEqual(["GR", "SP"]);
  });

  it("returns [] when curves are absent", () => {
    expect(exportCurveKeysFromMapping(null)).toEqual([]);
    expect(exportCurveKeysFromMapping({})).toEqual([]);
  });
});

describe("exportMappingFromState", () => {
  it("writes columns for lithology types and preserves other keys", () => {
    const mapping = exportMappingFromState(
      "corrected_lithology_csv",
      { extra: "keep", version: 3 },
      [{ source: "lithology.from_depth", target: "From" }],
      ["GR"],
    );
    expect(mapping).toEqual({
      extra: "keep",
      columns: [{ source: "lithology.from_depth", target: "From" }],
    });
  });

  it("writes curves for curve types only", () => {
    const mapping = exportMappingFromState("curves_las", { curves: ["old"], version: 2 }, [], ["GR"]);
    expect(mapping).toEqual({ curves: ["GR"] });
  });

  it("never writes columns or curves for unsupported types", () => {
    const mapping = exportMappingFromState("minex_demo", { columns: ["x"], curves: ["GR"] }, [], []);
    expect(mapping).toEqual({});
  });
});

describe("defaultExportColumns", () => {
  it("selects the standard Reliance columns in order, using field labels", () => {
    const columns = defaultExportColumns(SOURCE_FIELDS);
    expect(columns).toEqual([
      { source: "borehole.code", target: "Borehole code" },
      { source: "lithology.from_depth", target: "From depth" },
      { source: "lithology.to_depth", target: "To depth" },
      { source: "lithology.lithology_code", target: "Lithology code" },
      { source: "lithology.remark", target: "Remarks" },
    ]);
  });
});

describe("groupExportSourceFields", () => {
  it("groups fields by backend group while keeping order", () => {
    const groups = groupExportSourceFields(SOURCE_FIELDS);
    expect(groups.map((group) => group.group)).toEqual(["Borehole", "Depth", "Lithology", "Observations"]);
    expect(groups[1].fields.map((field) => field.key)).toEqual([
      "lithology.from_depth",
      "lithology.to_depth",
    ]);
  });
});

describe("exportTemplateErrors", () => {
  const base = {
    name: "Reliance handover",
    exportType: "corrected_lithology_xlsx",
    columns: [{ source: "lithology.from_depth", target: "From" }, { source: "lithology.to_depth", target: "To" }],
    sourceFields: SOURCE_FIELDS,
  };

  it("accepts a valid lithology mapping", () => {
    expect(exportTemplateErrors(base)).toEqual([]);
  });

  it("accepts custom attribute sources with the prefix", () => {
    expect(
      exportTemplateErrors({ ...base, columns: [{ source: "lithology.attributes.custom", target: "Custom" }] }),
    ).toEqual([]);
  });

  it("requires a name", () => {
    expect(exportTemplateErrors({ ...base, name: "  " })).toEqual(["Enter a template name."]);
  });

  it("rejects unknown sources, empty targets and duplicate output names", () => {
    const errors = exportTemplateErrors({
      ...base,
      columns: [
        { source: "not.a.field", target: "From" },
        { source: "lithology.from_depth", target: "" },
        { source: "lithology.to_depth", target: "From" },
      ],
    });
    expect(errors).toContain('Column 1: "not.a.field" is not an exportable field.');
    expect(errors).toContain("Column 2: give the output column a name.");
    expect(errors).toContain('Column 3: output name "From" is used more than once.');
  });

  it("rejects an empty column list for lithology types", () => {
    expect(exportTemplateErrors({ ...base, columns: [] })).toContain("Add at least one output column.");
  });

  it("does not require columns for curve types", () => {
    expect(exportTemplateErrors({ ...base, exportType: "curves_las", columns: [] })).toEqual([]);
  });

  it("flags formats without a visual editor", () => {
    expect(exportTemplateErrors({ ...base, exportType: "minex_demo" })).toEqual([
      "This export format has no visual template editor.",
    ]);
  });
});
