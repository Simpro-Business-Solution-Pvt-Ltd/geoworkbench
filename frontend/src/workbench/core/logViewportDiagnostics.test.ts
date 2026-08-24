import { describe, expect, it } from "vitest";

import { resolveLogViewport } from "./logViewport";
import {
  buildLogViewportDiagnostics,
  buildLogWidgetControlPlaneDiagnostics,
} from "./logViewportDiagnostics";

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

  it("summarizes the control-plane invariant snapshot", () => {
    const diagnostics = buildLogWidgetControlPlaneDiagnostics({
      virtualFromDepth: 0,
      virtualToDepth: 604.3,
      visibleFromDepth: 120,
      visibleToDepth: 160,
      visibleSpan: 40,
      scrollTop: 420,
      maxScrollTop: 900,
      pixelsPerDepth: 14.25,
      contentHeight: 1270,
      bodyHeight: 1200,
      visibleBodyHeight: 570,
      headerHeight: 70,
    });

    expect(diagnostics.map((item) => item.key)).toEqual([
      "virtualRange",
      "visibleRange",
      "visibleSpan",
      "scroll",
      "body",
      "header",
      "scale",
    ]);
    expect(diagnostics.find((item) => item.key === "visibleSpan")?.value).toBe("40 m");
    expect(diagnostics.find((item) => item.key === "header")?.value).toBe("70 px");
  });
});
