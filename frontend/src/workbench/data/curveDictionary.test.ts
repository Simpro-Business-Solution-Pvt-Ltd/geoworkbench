import { describe, expect, it } from "vitest";

import type { Curve } from "../../api/types";
import { compareCurvesByFamily, curveFamilyLabel, curveMappingStatus, curveMnemonic } from "./curveDictionary";

function curve(key: string, label: string, metadata: Record<string, unknown> | null = null): Curve {
  return {
    id: key.length,
    key,
    label,
    unit: "API",
    source_type: "las",
    color: "#ef4444",
    curve_metadata: metadata,
    samples: [],
  };
}

describe("curveDictionary", () => {
  it("reads mnemonic, family label, and mapping status from curve metadata", () => {
    const gamma = curve("gamma", "Natural Gamma", {
      mnemonic: "NGAM",
      curve_family: "gamma-ray",
      mapping_status: "mapped",
    });

    expect(curveMnemonic(gamma)).toBe("NGAM");
    expect(curveFamilyLabel(gamma)).toBe("Gamma ray");
    expect(curveMappingStatus(gamma)).toBe("mapped");
  });

  it("falls back safely for unmapped or legacy curves", () => {
    const custom = curve("foo", "Custom Curve");

    expect(curveMnemonic(custom)).toBe("foo");
    expect(curveFamilyLabel(custom)).toBe("Unmapped");
    expect(curveMappingStatus(custom)).toBe("unmapped");
  });

  it("recognizes legacy keys before existing boreholes are re-imported", () => {
    const legacyGamma = curve("ngamma", "Natural Gamma");
    const legacyDensity = curve("dens", "Density");

    expect(curveMnemonic(legacyGamma)).toBe("NGAM");
    expect(curveFamilyLabel(legacyGamma)).toBe("Gamma ray");
    expect(curveMappingStatus(legacyGamma)).toBe("mapped-by-key");
    expect(curveFamilyLabel(legacyDensity)).toBe("Density");
  });

  it("sorts mapped geology curves before unmapped curves", () => {
    const items = [
      curve("custom", "Custom Curve"),
      curve("resistivity", "Resistivity", { curve_family: "resistivity" }),
      curve("gamma", "Natural Gamma", { curve_family: "gamma-ray" }),
    ].sort(compareCurvesByFamily);

    expect(items.map((item) => item.key)).toEqual(["gamma", "resistivity", "custom"]);
  });
});
