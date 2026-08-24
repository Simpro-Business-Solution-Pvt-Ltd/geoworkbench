import { describe, expect, it } from "vitest";

import type { BoreholeWorkbench } from "../../api/types";
import {
  buildBoreholeExplorerTree,
  filterBoreholeExplorerTree,
  flattenBoreholeExplorerTree,
} from "./boreholeExplorerModel";

describe("boreholeExplorerModel", () => {
  it("builds a discoverable tree from the selected borehole payload", () => {
    const tree = buildBoreholeExplorerTree(sampleWorkbench());
    const nodes = flattenBoreholeExplorerTree(tree);

    expect(tree.label).toBe("PBH-62");
    expect(nodes.map((node) => node.id)).toContain("metadata:collar_rl");
    expect(nodes.map((node) => node.id)).toContain("intervals:lithology");
    expect(nodes.map((node) => node.id)).toContain("interval-field:recovery_percent");
    expect(nodes.map((node) => node.id)).toContain("curve:NGAM");
    expect(nodes.map((node) => node.id)).toContain("image:1:Box 1");
    expect(nodes.map((node) => node.id)).toContain("source-file:7");
    expect(nodes.map((node) => node.id)).toContain("quality-issue:11");
    expect(nodes.map((node) => node.id)).toContain("ai-suggestion:21");
  });

  it("creates typed drag payloads for data that can be dropped into LogWidget", () => {
    const nodes = flattenBoreholeExplorerTree(buildBoreholeExplorerTree(sampleWorkbench()));

    expect(nodes.find((node) => node.id === "curve:NGAM")?.dragPayload).toEqual({
      scope: "borehole",
      kind: "curve",
      curveKey: "NGAM",
    });
    expect(nodes.find((node) => node.id === "interval-field:rqd")?.dragPayload).toEqual({
      scope: "borehole",
      kind: "intervalField",
      field: "rqd",
      unit: "%",
    });
    expect(nodes.find((node) => node.id === "images")?.dragPayload).toEqual({
      scope: "borehole",
      kind: "imageGroup",
    });
  });

  it("filters the tree while keeping matching parents", () => {
    const tree = buildBoreholeExplorerTree(sampleWorkbench());
    const filtered = filterBoreholeExplorerTree(tree, "gamma");

    expect(filtered).not.toBeNull();
    const nodes = flattenBoreholeExplorerTree(filtered!);
    expect(nodes.map((node) => node.id)).toContain("geophysical-logs");
    expect(nodes.map((node) => node.id)).toContain("curve:NGAM");
    expect(nodes.map((node) => node.id)).not.toContain("curve:RES");
  });
});

function sampleWorkbench(): BoreholeWorkbench {
  return {
    id: 1,
    code: "PBH-62",
    title: "PBH 62",
    state: "active",
    total_depth: 120,
    closure_note: null,
    source_workbook: "sample.xlsx",
    source_sheet: "Sheet1",
    workflow_status: "review",
    attributes: {
      collar_rl: 186.4,
      easting: 500100,
      northing: 2200100,
    },
    lithology_intervals: [
      {
        id: "li-1",
        source_row: 1,
        from_depth: 0,
        to_depth: 10,
        lithology_code: "SS",
        lithology_label: "Sandstone",
        display_color: "#ddd",
        logged_color: null,
        seam_name: "S1",
        recovery: 0.9,
        recovery_percent: 90,
        rqd: 0.65,
        structural_features: "Fractured",
        remark: "Check gamma contact",
        image_box: 1,
        image_file: "box1.jpg",
      },
    ],
    seam_intervals: [
      {
        id: "seam-1",
        name: "S1",
        from_depth: 9,
        to_depth: 10,
        thickness: 1,
        lithology_code: "COAL",
        lithology_label: "Coal",
        image_box: 1,
      },
    ],
    curves: [
      {
        id: 1,
        key: "NGAM",
        label: "Natural Gamma",
        unit: "API",
        source_type: "LAS",
        color: "#c43",
        samples: [
          { depth: 0, value: 40 },
          { depth: 10, value: 80 },
        ],
      },
      {
        id: 2,
        key: "RES",
        label: "Resistivity",
        unit: "ohm.m",
        source_type: "LAS",
        color: "#33c",
        samples: [],
      },
    ],
    core_images: [
      {
        box_number: 1,
        name: "Box 1",
        file_path: "box1.jpg",
        from_depth: 0,
        to_depth: 4,
        url: "/files/box1.jpg",
        original_url: "/files/box1.jpg",
        strip_url: "/files/box1-strip.jpg",
      },
    ],
    layout: null,
    validation_issues: [
      {
        id: 11,
        code: "DEPTH_GAP",
        severity: "warning",
        message: "Gap between intervals",
        from_depth: 10,
        to_depth: 11,
        entity_type: "interval",
        entity_id: "li-1",
        status: "open",
        issue_metadata: null,
      },
    ],
    ai_suggestions: [
      {
        id: 21,
        validation_issue_id: 11,
        suggestion_type: "contact_review",
        title: "Review lithology contact",
        rationale: "Gamma response changes near boundary.",
        recommended_action: "Move contact after review",
        confidence: 0.72,
        status: "new",
        provider: "local",
        from_depth: 9.5,
        to_depth: 10.5,
        entity_type: "interval",
        entity_id: "li-1",
        patch: null,
        evidence: null,
      },
    ],
    source_imports: [],
    field_submissions: [],
    source_files: [
      {
        id: 7,
        borehole_id: 1,
        source_import_id: null,
        file_type: "xlsx",
        original_name: "sample.xlsx",
        storage_path: "uploads/sample.xlsx",
        status: "available",
        file_metadata: { rows: 10 },
      },
    ],
  };
}
