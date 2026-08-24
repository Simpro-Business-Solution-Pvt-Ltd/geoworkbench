type DiagnosticItem = {
  key: string;
  label: string;
  value: string;
};

type Props = {
  visibleFromDepth: number;
  visibleToDepth: number;
  domainFromDepth: number;
  domainToDepth: number;
  scaleLabel: string;
  domainSpan: number;
  isZoomed: boolean;
  tooltipsEnabled: boolean;
  diagnosticsVisible: boolean;
  diagnostics: DiagnosticItem[];
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullDepth: () => void;
  onToggleTooltips: () => void;
  onToggleDiagnostics: () => void;
};

export function LogWidgetFooter({
  visibleFromDepth,
  visibleToDepth,
  domainFromDepth,
  domainToDepth,
  scaleLabel,
  domainSpan,
  isZoomed,
  tooltipsEnabled,
  diagnosticsVisible,
  diagnostics,
  onZoomIn,
  onZoomOut,
  onFullDepth,
  onToggleTooltips,
  onToggleDiagnostics,
}: Props) {
  return (
    <div className="log-footer">
      <div className="log-footer-main">
        <span>
          Visible {visibleFromDepth.toFixed(2)}-{visibleToDepth.toFixed(2)} m
        </span>
        <span>
          Domain {domainFromDepth.toFixed(2)}-{domainToDepth.toFixed(2)} m ({domainSpan.toFixed(2)} m)
        </span>
        <span>{scaleLabel} px/m</span>
        <button type="button" onClick={onZoomIn}>Zoom in</button>
        <button type="button" onClick={onZoomOut}>Zoom out</button>
        <button type="button" onClick={onFullDepth} disabled={!isZoomed}>
          Full depth
        </button>
        <button type="button" onClick={onToggleTooltips}>
          {tooltipsEnabled ? "Tooltips on" : "Tooltips off"}
        </button>
        <button type="button" onClick={onToggleDiagnostics}>
          {diagnosticsVisible ? "Diagnostics off" : "Diagnostics"}
        </button>
      </div>
      {diagnosticsVisible && (
        <div className="log-diagnostics">
          {diagnostics.map((item) => (
            <span key={item.key}>
              <b>{item.label}</b>
              {item.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
