import { describe, expect, it } from "vitest";

import { resolveLogViewport } from "./logViewport";
import { buildLogViewportDiagnostics } from "./logViewportDiagnostics";

describe("logViewportDiagnostics", () => {
  it("summarizes virtual range, visible range, scroll, and scale", () => {
    const viewport = resolveLogViewport({
      depthDomain: { fromDepth: 0, toDepth: 604.3 },
      containerHeight: 640,
      headerHeight: 70,
      pixelsPerDepth: 3,
      scrollTop: 250,
      minPixelsPerDepth: 0.1,
    });

    const diagnostics = buildLogViewportDiagnostics(viewport);

    expect(diagnostics.map((item) => item.key)).toEqual([
      "virtualRange",
      "visibleRange",
      "scroll",
      "body",
      "scale",
      "domainSpan",
    ]);
    expect(diagnostics.find((item) => item.key === "virtualRange")?.value).toBe("0-604.3 m");
    expect(diagnostics.find((item) => item.key === "scroll")?.value).toContain("/");
    expect(diagnostics.find((item) => item.key === "scale")?.value).toBe("3 px/m");
  });
});
