import { describe, expect, it } from "vitest";

import { booleanRendererSetting, numericRendererSetting, stringRendererSetting } from "./rendererSettings";

describe("rendererSettings", () => {
  it("reads finite numeric renderer settings", () => {
    expect(numericRendererSetting({ renderer: { minYPixelSpacing: 2 } }, "minYPixelSpacing", 1.5)).toBe(2);
    expect(numericRendererSetting({ renderer: { minYPixelSpacing: Number.NaN } }, "minYPixelSpacing", 1.5)).toBe(1.5);
    expect(numericRendererSetting({ renderer: {} }, "maxWindowSamples", null)).toBeNull();
  });

  it("reads only allowed string renderer settings", () => {
    expect(
      stringRendererSetting(
        { renderer: { sampleSource: "visible-window" } },
        "sampleSource",
        ["workbench", "visible-window"],
        "workbench",
      ),
    ).toBe("visible-window");
    expect(
      stringRendererSetting(
        { renderer: { sampleSource: "unknown" } },
        "sampleSource",
        ["workbench", "visible-window"],
        "workbench",
      ),
    ).toBe("workbench");
  });

  it("reads boolean renderer settings", () => {
    expect(booleanRendererSetting({ renderer: { enabled: false } }, "enabled", true)).toBe(false);
    expect(booleanRendererSetting({ renderer: { enabled: "false" } }, "enabled", true)).toBe(true);
  });
});
