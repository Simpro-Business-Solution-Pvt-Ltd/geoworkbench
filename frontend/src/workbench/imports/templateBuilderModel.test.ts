import { describe, expect, it } from "vitest";

import {
  builderErrors,
  builderStateToMapping,
  emptyBuilderState,
  headersFromRow,
  mappingToBuilderState,
  requiredHeaders,
  suggestMapping,
} from "./templateBuilderModel";

// Header row of Reliance's Lithology_10BH.xlsx.
const RELIANCE_HEADERS = [
  "Borehole No.",
  "From (m)",
  "To (m)",
  "Total Length (m)",
  "Total Recovery (m)",
  "Recovery %",
  "Recovery Thickness (m)",
  "Extrapolated Thickness (m)",
  "Floor Depth (m)",
  "Lithology",
  "Colour",
  "Structural Features",
  "Other Details",
  "Formation",
  "Seam Name",
];

describe("suggestMapping", () => {
  it("maps the Reliance header row to the verified Reliance template", () => {
    const state = suggestMapping(RELIANCE_HEADERS, emptyBuilderState());
    expect(state.boreholeSource).toBe("column");
    expect(state.boreholeColumn).toBe("Borehole No.");
    expect(state.depthMode).toBe("to");
    expect(state.depthFrom).toBe("From (m)");
    expect(state.depthTo).toBe("To (m)");
    expect(state.fields.lithology).toBe("Lithology");
    expect(state.fields.recovery_percent).toBe("Recovery %");
    expect(state.fields.recovery).toBe("Recovery Thickness (m)");
    expect(state.fields.seam_name).toBe("Seam Name");
    expect(state.fields.logged_color).toBe("Colour");
    expect(state.fields.structural_features).toBe("Structural Features");
    expect(state.fields.rqd).toBe("");
    expect(state.remarkColumns).toEqual(["Other Details", "Formation"]);
  });

  it("falls back to thickness when there is no To column", () => {
    const state = suggestMapping(["Hole ID", "From", "Thickness", "Lithology"], emptyBuilderState());
    expect(state.depthMode).toBe("thickness");
    expect(state.depthThickness).toBe("Thickness");
    expect(state.boreholeColumn).toBe("Hole ID");
  });

  it("does not read 'Total Length' as the To column", () => {
    const state = suggestMapping(["From (m)", "Total Length (m)", "Lithology"], emptyBuilderState());
    expect(state.depthTo).toBe("");
    expect(state.depthThickness).toBe("Total Length (m)");
  });
});

describe("builderStateToMapping / mappingToBuilderState", () => {
  it("round-trips a template through the form", () => {
    const state = { ...suggestMapping(RELIANCE_HEADERS, emptyBuilderState()), normalize: "zero_pad_number:2" as const };
    const mapping = builderStateToMapping(state);
    expect(mapping).toMatchObject({
      kind: "tabular_intervals",
      detect: { sheet: "first", required_headers: ["Borehole No.", "From (m)", "To (m)", "Lithology"] },
      borehole: { source: "column", column: "Borehole No.", normalize: "zero_pad_number:2" },
      depth: { from: "From (m)", to: "To (m)" },
      fields: { lithology: "Lithology", remark: ["Other Details", "Formation"] },
    });
    expect(mappingToBuilderState(mapping)).toEqual(state);
  });

  it("writes a single remark column as a string", () => {
    const state = { ...emptyBuilderState(), remarkColumns: ["Remarks"] };
    expect((builderStateToMapping(state).fields as Record<string, unknown>).remark).toBe("Remarks");
  });

  it("tolerates partial or foreign JSON", () => {
    const state = mappingToBuilderState({ depth: { from: "A", thickness: "B" }, borehole: { normalize: "bogus" } });
    expect(state.depthMode).toBe("thickness");
    expect(state.normalize).toBe("none");
    expect(state.headerRow).toBe(1);
  });
});

describe("builderErrors and requiredHeaders", () => {
  it("lists every missing required mapping", () => {
    expect(builderErrors(emptyBuilderState())).toEqual([
      "Choose the From-depth column.",
      "Choose the To-depth column.",
      "Choose the lithology column.",
    ]);
  });

  it("is clean for a complete mapping", () => {
    expect(builderErrors(suggestMapping(RELIANCE_HEADERS, emptyBuilderState()))).toEqual([]);
  });

  it("omits the borehole column from required headers for one-borehole files", () => {
    const state = { ...suggestMapping(RELIANCE_HEADERS, emptyBuilderState()), boreholeSource: "selected" as const };
    expect(requiredHeaders(state)).toEqual(["From (m)", "To (m)", "Lithology"]);
  });
});

describe("headersFromRow", () => {
  it("reads non-empty headers from a 1-based row", () => {
    expect(headersFromRow([["Title"], ["From", null, "To", ""]], 2)).toEqual(["From", "To"]);
  });
});
