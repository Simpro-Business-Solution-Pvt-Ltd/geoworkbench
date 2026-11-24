import { describe, expect, it } from "vitest";

import type { SeamInterval } from "../../api/types";
import { seamOccurrences } from "./seamOccurrences";

describe("seam occurrences", () => {
  it("merges a seam logged band by band into one top and bottom", () => {
    // LK-3 SECTION-5 in MGCA-08-UAT: four touching bands, 93.07-94.61 m.
    const result = seamOccurrences([
      seam("LK-3 SECTION-5", 93.7, 94.28),
      seam("LK-3 SECTION-5", 93.07, 93.53),
      seam("LK-3 SECTION-5", 94.28, 94.61),
      seam("LK-3 SECTION-5", 93.53, 93.7),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ key: "LK-3 SECTION-5", from_depth: 93.07, to_depth: 94.61, bandCount: 4 });
  });

  it("merges same-name bands split by a thin parting", () => {
    const result = seamOccurrences([seam("A", 100, 101), seam("A", 101.6, 102.4)]);
    expect(result).toEqual([expect.objectContaining({ from_depth: 100, to_depth: 102.4, bandCount: 2 })]);
  });

  it("keeps far-apart same-name records as separate occurrences", () => {
    const result = seamOccurrences([seam("BAND", 774.2, 775.41), seam("BAND", 449.76, 450.19)]);
    expect(result.map((item) => [item.from_depth, item.to_depth])).toEqual([
      [449.76, 450.19],
      [774.2, 775.41],
    ]);
  });

  it("leaves single-record seams unchanged and matches names case-insensitively", () => {
    const result = seamOccurrences([seam("lk-1-top", 40.35, 40.67), seam("B", 10, 11)]);
    expect(result).toEqual([
      expect.objectContaining({ key: "B", from_depth: 10, to_depth: 11, bandCount: 1 }),
      expect.objectContaining({ key: "LK-1-TOP", from_depth: 40.35, to_depth: 40.67, bandCount: 1 }),
    ]);
  });
});

function seam(name: string, from: number, to: number): SeamInterval {
  return {
    id: `${name}-${from}-${to}`,
    name,
    from_depth: from,
    to_depth: to,
    thickness: to - from,
    lithology_code: "COAL",
    lithology_label: "Coal",
    image_box: null,
    attributes: null,
  };
}
