type Props = {
  depth: number;
  trackType: string;
  objectKind: string;
  x: number;
  y: number;
  tooltipsEnabled: boolean;
  diagnosticsVisible: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullDepth: () => void;
  onToggleTooltips: () => void;
  onToggleDiagnostics: () => void;
  onClose: () => void;
};

export function LogContextMenu({
  depth,
  trackType,
  objectKind,
  x,
  y,
  tooltipsEnabled,
  diagnosticsVisible,
  onZoomIn,
  onZoomOut,
  onFullDepth,
  onToggleTooltips,
  onToggleDiagnostics,
  onClose,
}: Props) {
  return (
    <div className="track-context-menu" style={{ left: x, top: y }}>
      <strong>{trackType}</strong>
      <span>{depth.toFixed(2)} m</span>
      <span>{objectKind}</span>
      <button type="button" onClick={onZoomIn}>Zoom in here</button>
      <button type="button" onClick={onZoomOut}>Zoom out here</button>
      <button type="button" onClick={onFullDepth}>Full depth</button>
      <button type="button" onClick={onToggleTooltips}>
        {tooltipsEnabled ? "Disable tooltips" : "Enable tooltips"}
      </button>
      <button type="button" onClick={onToggleDiagnostics}>
        {diagnosticsVisible ? "Hide diagnostics" : "Show diagnostics"}
      </button>
      <button type="button" onClick={onClose}>Close</button>
    </div>
  );
}
