import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import type { BoreholeWorkbench } from "../../api/types";
import { FloatingWindow } from "../ui/FloatingWindow";
import {
  buildBoreholeExplorerTree,
  filterBoreholeExplorerTree,
  type BoreholeExplorerNode,
} from "./boreholeExplorerModel";

type Props = {
  data: BoreholeWorkbench;
  onClose: () => void;
};

const DRAG_MIME_TYPE = "application/geoworkbench-borehole-explorer";
const DEFAULT_EXPANDED = new Set(["metadata", "intervals", "geophysical-logs", "images", "quality-ai"]);

export function BoreholeExplorer({ data, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(DEFAULT_EXPANDED));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const root = useMemo(() => buildBoreholeExplorerTree(data), [data]);
  const visibleRoot = useMemo(() => filterBoreholeExplorerTree(root, query) ?? root, [query, root]);
  const selectedNode = useMemo(() => findNode(root, selectedNodeId), [root, selectedNodeId]);

  const toggle = (nodeId: string) => {
    setExpanded((items) => {
      const next = new Set(items);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  return (
    <FloatingWindow title="Borehole Explorer" className="borehole-explorer-window" onClose={onClose}>
      <div className="borehole-explorer-search">
        <Search size={14} strokeWidth={2.1} />
        <input value={query} placeholder="Search data" onChange={(event) => setQuery(event.target.value)} />
      </div>

      <div className="borehole-explorer-body">
        <div className="borehole-explorer-tree">
          <ExplorerNode
            node={visibleRoot}
            depth={0}
            expanded={expanded}
            selectedNodeId={selectedNodeId}
            onToggle={toggle}
            onSelect={setSelectedNodeId}
          />
        </div>
          <NodePreview node={selectedNode} />
      </div>
    </FloatingWindow>
  );
}

function ExplorerNode({
  node,
  depth,
  expanded,
  selectedNodeId,
  onToggle,
  onSelect,
}: {
  node: BoreholeExplorerNode;
  depth: number;
  expanded: Set<string>;
  selectedNodeId: string | null;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = hasChildren && expanded.has(node.id);
  const isSelected = selectedNodeId === node.id;

  return (
    <div className="borehole-explorer-node-wrap">
      <button
        type="button"
        className={`borehole-explorer-node ${isSelected ? "selected" : ""} ${node.available ? "" : "unavailable"}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={Boolean(node.dragPayload)}
        onDragStart={(event) => {
          if (!node.dragPayload) return;
          event.dataTransfer.setData(DRAG_MIME_TYPE, JSON.stringify(node.dragPayload));
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => {
          if (hasChildren) onToggle(node.id);
        }}
      >
        <span
          className="borehole-explorer-toggle"
          onClick={(event) => {
            event.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {hasChildren ? isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} /> : null}
        </span>
        <span className="borehole-explorer-label">
          <strong>{node.label}</strong>
          {node.secondary && <small>{node.secondary}</small>}
        </span>
        {typeof node.count === "number" && <b>{node.count}</b>}
      </button>
      {isExpanded &&
        node.children?.map((child) => (
          <ExplorerNode
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            selectedNodeId={selectedNodeId}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

function NodePreview({ node }: { node: BoreholeExplorerNode | null }) {
  if (!node) {
    return (
      <aside className="borehole-explorer-preview">
        <strong>Selection</strong>
        <span>Select a data item to inspect its source and availability.</span>
      </aside>
    );
  }
  const metadata = Object.entries(node.metadata ?? {}).filter(([, value]) => value !== undefined && value !== null);
  return (
    <aside className="borehole-explorer-preview">
      <strong>{node.label}</strong>
      {node.secondary && <span>{node.secondary}</span>}
      <dl>
        <div>
          <dt>Type</dt>
          <dd>{node.kind}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{node.available ? "Available" : "Missing"}</dd>
        </div>
        {node.unit && (
          <div>
            <dt>Unit</dt>
            <dd>{node.unit}</dd>
          </div>
        )}
        {metadata.slice(0, 7).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{formatPreviewValue(value)}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function findNode(root: BoreholeExplorerNode, nodeId: string | null): BoreholeExplorerNode | null {
  if (!nodeId) return null;
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return null;
}

function formatPreviewValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `${value.length} items`;
  return "Object";
}

export { DRAG_MIME_TYPE as BOREHOLE_EXPLORER_DRAG_MIME_TYPE };
