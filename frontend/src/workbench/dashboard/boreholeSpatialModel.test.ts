import { describe, expect, it } from "vitest";

import { buildBoreholeMapModel, projectBoreholePoint } from "./boreholeSpatialModel";
import type { BoreholeListItem } from "../../api/types";

describe("boreholeSpatialModel", () => {
  it("builds plottable points and separates missing coordinates", () => {
    const model = buildBoreholeMapModel([
      borehole(1, "A", 100, 200),
      borehole(2, "B", 120, 260),
      { ...borehole(3, "C", 0, 0), coordinates: null },
    ]);

    expect(model.points.map((point) => point.code)).toEqual(["A", "B"]);
    expect(model.missing.map((item) => item.code)).toEqual(["C"]);
    expect(model.bounds).toEqual({ minX: 100, maxX: 120, minY: 200, maxY: 260 });
    expect(model.coordinateSystem).toBe("utm");
  });

  it("projects model coordinates into screen coordinates with north-up y inversion", () => {
    const model = buildBoreholeMapModel([borehole(1, "A", 100, 200), borehole(2, "B", 200, 300)]);
    const point = projectBoreholePoint(model.points[1], model.bounds!, 200, 120, 20);

    expect(point).toEqual({ x: 180, y: 20 });
  });
});

function borehole(id: number, code: string, x: number, y: number): BoreholeListItem {
  return {
    id,
    code,
    title: `${code} title`,
    total_depth: 100,
    workflow_status: "imported",
    project_code: "RELIANCE",
    site_code: "MGCA",
    coordinates: {
      system: "utm",
      x,
      y,
      x_label: "utm_easting",
      y_label: "utm_northing",
    },
  };
}
