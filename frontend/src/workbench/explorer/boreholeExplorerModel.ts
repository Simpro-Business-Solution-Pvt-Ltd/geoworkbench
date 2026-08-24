import type {
  AiSuggestion,
  BoreholeWorkbench,
  CoreImage,
  Curve,
  LithologyInterval,
  SeamInterval,
  SourceFile,
  ValidationIssue,
} from "../../api/types";

export type BoreholeExplorerNodeKind =
  | "root"
  | "group"
  | "metadata"
  | "intervalSet"
  | "intervalField"
  | "curveGroup"
  | "curve"
  | "imageGroup"
  | "image"
  | "sourceFile"
  | "qualityIssue"
  | "aiSuggestion";

export type BoreholeExplorerDragPayload =
  | { scope: "borehole"; kind: "metadata"; field: string }
  | { scope: "borehole"; kind: "intervalSet"; intervalType: "lithology" | "seam" }
  | { scope: "borehole"; kind: "intervalField"; field: string; unit?: string | null }
  | { scope: "borehole"; kind: "curveGroup"; curveKeys: string[] }
  | { scope: "borehole"; kind: "curve"; curveKey: string }
  | { scope: "borehole"; kind: "imageGroup" }
  | { scope: "borehole"; kind: "image"; boxNumber: number; imageName: string }
  | { scope: "borehole"; kind: "qualityIssue"; issueId: number }
  | { scope: "borehole"; kind: "aiSuggestion"; suggestionId: number };

export type BoreholeExplorerNode = {
  id: string;
  kind: BoreholeExplorerNodeKind;
  label: string;
  secondary?: string;
  count?: number;
  unit?: string | null;
  available: boolean;
  searchText: string;
  dragPayload?: BoreholeExplorerDragPayload;
  metadata?: Record<string, unknown>;
  children?: BoreholeExplorerNode[];
};

export function buildBoreholeExplorerTree(data: BoreholeWorkbench): BoreholeExplorerNode {
  const children: BoreholeExplorerNode[] = [
    metadataGroup(data),
    intervalsGroup(data),
    geophysicalLogsGroup(data),
    imagesGroup(data),
    sourceFilesGroup(data),
    qualityAndAiGroup(data),
  ];

  return makeNode({
    id: `borehole:${data.id}`,
    kind: "root",
    label: data.code,
    secondary: data.title,
    available: true,
    metadata: {
      boreholeId: data.id,
      totalDepth: data.total_depth,
      workflowStatus: data.workflow_status,
      state: data.state,
    },
    children,
  });
}

export function flattenBoreholeExplorerTree(root: BoreholeExplorerNode): BoreholeExplorerNode[] {
  const nodes: BoreholeExplorerNode[] = [];
  const visit = (node: BoreholeExplorerNode) => {
    nodes.push(node);
    node.children?.forEach(visit);
  };
  visit(root);
  return nodes;
}

export function filterBoreholeExplorerTree(
  root: BoreholeExplorerNode,
  query: string,
): BoreholeExplorerNode | null {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return root;

  const filterNode = (node: BoreholeExplorerNode): BoreholeExplorerNode | null => {
    const children = node.children?.map(filterNode).filter((child): child is BoreholeExplorerNode => Boolean(child));
    const matches = node.searchText.includes(normalizedQuery);
    if (!matches && (!children || children.length === 0)) return null;
    return { ...node, children };
  };

  return filterNode(root);
}

function metadataGroup(data: BoreholeWorkbench): BoreholeExplorerNode {
  const attrs = data.attributes ?? {};
  const metadataItems = [
    metadataNode("total_depth", "Total depth", formatDepth(data.total_depth), true, data.total_depth),
    metadataNode("workflow_status", "Workflow status", data.workflow_status, Boolean(data.workflow_status), data.workflow_status),
    metadataNode("state", "State", data.state ?? "Not captured", Boolean(data.state), data.state),
    metadataNode("source_workbook", "Source workbook", data.source_workbook ?? "Not captured", Boolean(data.source_workbook), data.source_workbook),
    metadataNode("source_sheet", "Source sheet", data.source_sheet ?? "Not captured", Boolean(data.source_sheet), data.source_sheet),
    ...objectMetadataNodes(attrs),
  ];

  return makeNode({
    id: "metadata",
    kind: "group",
    label: "Metadata",
    count: metadataItems.filter((item) => item.available).length,
    available: metadataItems.some((item) => item.available),
    children: metadataItems,
  });
}

function intervalsGroup(data: BoreholeWorkbench): BoreholeExplorerNode {
  const lithology = intervalSetNode("lithology", "Lithology intervals", data.lithology_intervals);
  const seam = seamSetNode(data.seam_intervals);
  const fieldNodes = intervalFieldNodes(data.lithology_intervals);
  const children = [lithology, seam, ...fieldNodes];
  return makeNode({
    id: "intervals",
    kind: "group",
    label: "Intervals",
    count: data.lithology_intervals.length + data.seam_intervals.length,
    available: children.some((item) => item.available),
    children,
  });
}

function geophysicalLogsGroup(data: BoreholeWorkbench): BoreholeExplorerNode {
  const curveNodes = data.curves.map(curveNode);
  return makeNode({
    id: "geophysical-logs",
    kind: "curveGroup",
    label: "Geophysical logs",
    count: data.curves.length,
    available: data.curves.length > 0,
    dragPayload: {
      scope: "borehole",
      kind: "curveGroup",
      curveKeys: data.curves.map((curve) => curve.key),
    },
    children: curveNodes,
  });
}

function imagesGroup(data: BoreholeWorkbench): BoreholeExplorerNode {
  const images = data.core_images.map(imageNode);
  return makeNode({
    id: "images",
    kind: "imageGroup",
    label: "Images",
    count: data.core_images.length,
    available: data.core_images.length > 0,
    dragPayload: { scope: "borehole", kind: "imageGroup" },
    children: images,
  });
}

function sourceFilesGroup(data: BoreholeWorkbench): BoreholeExplorerNode {
  const files = data.source_files.map(sourceFileNode);
  return makeNode({
    id: "source-files",
    kind: "group",
    label: "Source files",
    count: files.length,
    available: files.length > 0,
    children: files,
  });
}

function qualityAndAiGroup(data: BoreholeWorkbench): BoreholeExplorerNode {
  const issues = data.validation_issues.map(issueNode);
  const suggestions = data.ai_suggestions.map(suggestionNode);
  const children = [
    makeNode({
      id: "quality-issues",
      kind: "group",
      label: "Validation issues",
      count: issues.length,
      available: issues.length > 0,
      children: issues,
    }),
    makeNode({
      id: "ai-suggestions",
      kind: "group",
      label: "AI suggestions",
      count: suggestions.length,
      available: suggestions.length > 0,
      children: suggestions,
    }),
  ];
  return makeNode({
    id: "quality-ai",
    kind: "group",
    label: "Quality and AI",
    count: issues.length + suggestions.length,
    available: children.some((item) => item.available),
    children,
  });
}

function metadataNode(id: string, label: string, secondary: string, available: boolean, value: unknown): BoreholeExplorerNode {
  return makeNode({
    id: `metadata:${id}`,
    kind: "metadata",
    label,
    secondary,
    available,
    dragPayload: { scope: "borehole", kind: "metadata", field: id },
    metadata: { field: id, value },
  });
}

function objectMetadataNodes(attributes: Record<string, unknown>): BoreholeExplorerNode[] {
  return Object.entries(attributes)
    .filter(([, value]) => value !== null && value !== undefined && typeof value !== "object")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => metadataNode(key, titleFromKey(key), String(value), true, value));
}

function intervalSetNode(
  type: "lithology",
  label: string,
  intervals: LithologyInterval[],
): BoreholeExplorerNode {
  return makeNode({
    id: `intervals:${type}`,
    kind: "intervalSet",
    label,
    count: intervals.length,
    available: intervals.length > 0,
    secondary: depthCoverage(intervals),
    dragPayload: { scope: "borehole", kind: "intervalSet", intervalType: type },
    metadata: { intervalType: type },
  });
}

function seamSetNode(intervals: SeamInterval[]): BoreholeExplorerNode {
  return makeNode({
    id: "intervals:seam",
    kind: "intervalSet",
    label: "Seam intervals",
    count: intervals.length,
    available: intervals.length > 0,
    secondary: depthCoverage(intervals),
    dragPayload: { scope: "borehole", kind: "intervalSet", intervalType: "seam" },
    metadata: { intervalType: "seam" },
  });
}

function intervalFieldNodes(intervals: LithologyInterval[]): BoreholeExplorerNode[] {
  const fieldDefinitions = [
    { field: "recovery_percent", label: "Recovery", unit: "%" },
    { field: "rqd", label: "RQD", unit: "%" },
    { field: "remark", label: "Remarks", unit: null },
    { field: "structural_features", label: "Structural features", unit: null },
    { field: "seam_name", label: "Seam name", unit: null },
  ] as const;

  return fieldDefinitions.map(({ field, label, unit }) => {
    const availableCount = intervals.filter((interval) => valuePresent(interval[field])).length;
    return makeNode({
      id: `interval-field:${field}`,
      kind: "intervalField",
      label,
      count: availableCount,
      unit,
      available: availableCount > 0,
      secondary: availableCount > 0 ? `${availableCount} populated intervals` : "No values captured",
      dragPayload: { scope: "borehole", kind: "intervalField", field, unit },
      metadata: { field, unit },
    });
  });
}

function curveNode(curve: Curve): BoreholeExplorerNode {
  return makeNode({
    id: `curve:${curve.key}`,
    kind: "curve",
    label: curve.label || curve.key,
    secondary: `${curve.key}${curve.unit ? `, ${curve.unit}` : ""} · ${curve.samples.length} samples`,
    count: curve.samples.length,
    unit: curve.unit,
    available: curve.samples.length > 0,
    dragPayload: { scope: "borehole", kind: "curve", curveKey: curve.key },
    metadata: {
      curveId: curve.id,
      key: curve.key,
      unit: curve.unit,
      sourceType: curve.source_type,
      color: curve.color,
      depthCoverage: depthCoverage(curve.samples.map((sample) => ({ from_depth: sample.depth, to_depth: sample.depth }))),
      ...(curve.curve_metadata ?? {}),
    },
  });
}

function imageNode(image: CoreImage): BoreholeExplorerNode {
  return makeNode({
    id: `image:${image.box_number}:${image.name}`,
    kind: "image",
    label: image.name,
    secondary: image.from_depth !== null && image.to_depth !== null ? `${formatDepth(image.from_depth)} - ${formatDepth(image.to_depth)}` : "Depth not mapped",
    available: Boolean(image.url || image.strip_url || image.original_url),
    dragPayload: { scope: "borehole", kind: "image", boxNumber: image.box_number, imageName: image.name },
    metadata: {
      boxNumber: image.box_number,
      fromDepth: image.from_depth,
      toDepth: image.to_depth,
      hasStrip: Boolean(image.strip_url),
      stripMetadata: image.strip_metadata,
      imageMetadata: image.image_metadata,
    },
  });
}

function sourceFileNode(file: SourceFile): BoreholeExplorerNode {
  return makeNode({
    id: `source-file:${file.id}`,
    kind: "sourceFile",
    label: file.original_name,
    secondary: `${file.file_type} · ${file.status}`,
    available: file.status !== "deleted",
    metadata: {
      fileId: file.id,
      fileType: file.file_type,
      storagePath: file.storage_path,
      sourceImportId: file.source_import_id,
      ...(file.file_metadata ?? {}),
    },
  });
}

function issueNode(issue: ValidationIssue): BoreholeExplorerNode {
  return makeNode({
    id: `quality-issue:${issue.id}`,
    kind: "qualityIssue",
    label: issue.code,
    secondary: `${issue.severity} · ${issue.message}`,
    available: issue.status !== "resolved",
    dragPayload: { scope: "borehole", kind: "qualityIssue", issueId: issue.id },
    metadata: {
      issueId: issue.id,
      status: issue.status,
      severity: issue.severity,
      fromDepth: issue.from_depth,
      toDepth: issue.to_depth,
      entityType: issue.entity_type,
      entityId: issue.entity_id,
      issueMetadata: issue.issue_metadata,
    },
  });
}

function suggestionNode(suggestion: AiSuggestion): BoreholeExplorerNode {
  return makeNode({
    id: `ai-suggestion:${suggestion.id}`,
    kind: "aiSuggestion",
    label: suggestion.title,
    secondary: `${suggestion.status} · ${suggestion.recommended_action}`,
    available: suggestion.status !== "accepted" && suggestion.status !== "rejected",
    dragPayload: { scope: "borehole", kind: "aiSuggestion", suggestionId: suggestion.id },
    metadata: {
      suggestionId: suggestion.id,
      type: suggestion.suggestion_type,
      confidence: suggestion.confidence,
      provider: suggestion.provider,
      fromDepth: suggestion.from_depth,
      toDepth: suggestion.to_depth,
      entityType: suggestion.entity_type,
      entityId: suggestion.entity_id,
      evidence: suggestion.evidence,
    },
  });
}

function makeNode(node: Omit<BoreholeExplorerNode, "searchText"> & { searchText?: string }): BoreholeExplorerNode {
  return {
    ...node,
    searchText: node.searchText ?? normalizeSearch([node.label, node.secondary, node.unit, node.kind, node.id].filter(Boolean).join(" ")),
  };
}

function depthCoverage(items: Array<{ from_depth: number; to_depth: number }>) {
  if (!items.length) return "No depth coverage";
  const fromDepth = Math.min(...items.map((item) => item.from_depth));
  const toDepth = Math.max(...items.map((item) => item.to_depth));
  return `${formatDepth(fromDepth)} - ${formatDepth(toDepth)}`;
}

function formatDepth(depth: number) {
  return `${depth.toFixed(depth % 1 === 0 ? 0 : 2)} m`;
}

function titleFromKey(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function valuePresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}
