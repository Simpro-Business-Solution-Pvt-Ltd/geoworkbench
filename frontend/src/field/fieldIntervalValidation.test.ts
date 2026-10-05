import { describe, expect, it } from "vitest";

import { checkFieldInterval, type FieldIntervalInput } from "./fieldIntervalValidation";

const base: FieldIntervalInput = {
  fromDepth: "41.49",
  toDepth: "42.00",
  lithologyCode: "SHCOAL",
  recovery: "0.48",
  recoveryPercent: "94.1",
  rqd: "65",
  currentDepth: "120",
};

describe("field interval checks", () => {
  it("accepts a real Reliance coal interval", () => {
    expect(checkFieldInterval(base)).toEqual({ errors: {}, warnings: {}, missing: [], canSync: true });
  });

  it("rejects To shallower than From (UAT case 1)", () => {
    const result = checkFieldInterval({ ...base, fromDepth: "50", toDepth: "40", recovery: "", recoveryPercent: "" });
    expect(result.errors.toDepth).toBe("Must be deeper than From depth (50 m).");
    expect(result.canSync).toBe(false);
  });

  it("rejects recovery % above 100 (UAT case 2)", () => {
    const result = checkFieldInterval({ ...base, recovery: "", recoveryPercent: "150" });
    expect(result.errors.recoveryPercent).toBe("Must be between 0 and 100.");
    expect(result.canSync).toBe(false);
  });

  it("rejects RQD % above 100 (UAT case 3)", () => {
    expect(checkFieldInterval({ ...base, rqd: "150" }).errors.rqd).toBe("Must be between 0 and 100.");
  });

  it("lists what is still needed on an empty form (UAT case 4)", () => {
    const result = checkFieldInterval({
      fromDepth: "",
      toDepth: "",
      lithologyCode: "",
      recovery: "",
      recoveryPercent: "",
      rqd: "",
      currentDepth: "",
    });
    expect(result.missing).toEqual(["From depth", "To depth", "Lithology code"]);
    expect(result.errors).toEqual({});
    expect(result.canSync).toBe(false);
  });

  it("rejects recovery longer than the interval and non-numbers", () => {
    const result = checkFieldInterval({ ...base, recovery: "0.9", recoveryPercent: "", fromDepth: "abc" });
    expect(result.errors.fromDepth).toBe("Enter a number in metres.");
    expect(checkFieldInterval({ ...base, recovery: "0.9", recoveryPercent: "" }).errors.recovery).toBe(
      "Cannot exceed the interval thickness (0.51 m).",
    );
  });

  it("warns but allows when To is below the current drilled depth", () => {
    const result = checkFieldInterval({ ...base, currentDepth: "30" });
    expect(result.warnings.toDepth).toBe("Deeper than the current drilled depth (30 m). Check both values.");
    expect(result.canSync).toBe(true);
  });

  it("warns but allows when recovery m and % disagree", () => {
    const result = checkFieldInterval({ ...base, recoveryPercent: "50" });
    expect(result.warnings.recoveryPercent).toBe("Recovery 0.48 m over 0.51 m is 94.1 %, not 50 %.");
    expect(result.canSync).toBe(true);
  });
});
