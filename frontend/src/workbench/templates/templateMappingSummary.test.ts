import { describe, expect, it } from "vitest";

import { mappingRowsFromTemplate, safeMappingFromText } from "./templateMappingSummary";

describe("templateMappingSummary", () => {
  it("summarizes nested Excel import mappings as source column to canonical field", () => {
    const rows = mappingRowsFromTemplate({
      template_key: "ctsj_descriptive_v1",
      lithology: {
        from_depth: "F",
        to_depth: "G",
        lithology_code: "I",
      },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { source: "F", target: "lithology.from_depth" },
        { source: "G", target: "lithology.to_depth" },
        { source: "I", target: "lithology.lithology_code" },
      ]),
    );
  });

  it("summarizes export column templates as canonical source to output target", () => {
    const rows = mappingRowsFromTemplate({
      columns: [
        { source: "lithology.from_depth", target: "From Depth" },
        { source: "lithology.to_depth", target: "To Depth" },
      ],
    });

    expect(rows).toEqual([
      { source: "lithology.from_depth", target: "From Depth", detail: "column" },
      { source: "lithology.to_depth", target: "To Depth", detail: "column" },
    ]);
  });

  it("expands curve dictionaries into visible mnemonic mappings", () => {
    const rows = mappingRowsFromTemplate({
      curve_dictionary: {
        gamma: ["GR", "NGAM"],
        resistivity: ["RES"],
      },
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { source: "GR", target: "curve_dictionary.gamma", detail: "curve dictionary" },
        { source: "NGAM", target: "curve_dictionary.gamma", detail: "curve dictionary" },
        { source: "RES", target: "curve_dictionary.resistivity", detail: "curve dictionary" },
      ]),
    );
  });

  it("returns null for invalid mapping text", () => {
    expect(safeMappingFromText("{not json")).toBeNull();
  });
});
