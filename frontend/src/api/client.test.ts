import { describe, expect, it } from "vitest";

import { ApiError, isUnauthorizedError } from "./client";

describe("ApiError", () => {
  it("identifies unauthorized responses without treating every error as logout", () => {
    expect(isUnauthorizedError(new ApiError(401, "missing token"))).toBe(true);
    expect(isUnauthorizedError(new ApiError(502, "proxy unavailable"))).toBe(false);
    expect(isUnauthorizedError(new Error("network failed"))).toBe(false);
  });
});
