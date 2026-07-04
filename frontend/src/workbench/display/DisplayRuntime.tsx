import type { PointerEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";

import type {
  BoreholeAiSummary,
  BoreholeWorkbench,
  CoreImage,
  Curve,
  DisplayLayout,
  ExportJob,
  ExportReadiness,
  ImportProfile,
  LithologyInterval,
} from "../../api/types";
import { AiWorkflowPanel } from "../ai/AiWorkflowPanel";
import { ExportPanel } from "../exports/ExportPanel";
import { LogWidget } from "../widgets/LogWidget";
import { useWorkbenchStore } from "./workbenchStore";
import { normalizeDisplayLayout } from "./displayEditorModel";

type Props = {
  data: BoreholeWorkbench;
  aiSummary?: BoreholeAiSummary;
  aiProvider?: Record<string, unknown>;
  exportReadiness?: ExportReadiness;
  exportJobs?: ExportJob[];
  importProfiles?: ImportProfile[];
  selectedInterval: LithologyInterval | null;
  selectedCoreImage: CoreImage | null;
  validationRunning: boolean;
  aiGenerating: boolean;
  aiActing: boolean;
  exportCreating: boolean;
  exportApproving: boolean;
  sourceRegistering: boolean;
  sourceUploading: boolean;
  sourceProcessing: boolean;
  sourceImporting: boolean;
  sourceMerging: boolean;
  intervalSaving: boolean;
  onRunValidation: () => void;
  onGenerateAi: () => void;
  onAcceptSuggestion: (suggestionId: number) => void;
  onRejectSuggestion: (suggestionId: number) => void;
  onCreateExport: (exportType: string) => void;
  onApproveExport: () => void;
  onRegisterSourceFile: (payload: {
    file_type: string;
    original_name: string;
    storage_path?: string;
    file_metadata?: Record<string, unknown>;
  }) => void;
  onUploadSourceFile: (payload: { file_type: string; file: File }) => void;
  onProcessSourceFile: (sourceFileId: number) => void;
  onImportBoreholeFile: (sourceFileId: number) => void;
  onMergeSourceFile: (sourceFileId: number) => void;
  onSaveInterval: (patch: Partial<LithologyInterval>) => void;
  onSelectImage: (image: CoreImage) => void;
};

export function DisplayRuntime(props: Props) {
  const layout = useMemo(
    () => (props.data.layout ? normalizeDisplayLayout(props.data.layout as DisplayLayout, props.data.curves) : null),
    [props.data.curves, props.data.layout],
  );
  const grid = layout?.settings.grid;
  const widgets = layout?.settings.widgets ?? {};

  if (!grid) {
    return <div className="empty">No display grid is configured.</div>;
  }

  return (
    <section className="runtime-display">
      <div
        className="runtime-grid"
        style={{
          gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
          gridAutoRows: `${grid.rowHeight}px`,
        }}
      >
        {grid.items.map((item) => {
          const widget = widgets[item.widgetId];
          if (!widget) return null;
          return (
            <section
              key={item.widgetId}
              className={`runtime-widget runtime-widget-${widget.type}`}
              style={{
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`,
              }}
            >
              {renderWidget(item.widgetId, widget, props)}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function renderWidget(widgetId: string, widget: NonNullable<DisplayLayout["settings"]["widgets"]>[string], props: Props) {
  if (widget.type === "singleValue") {
    return <SingleValueWidget title={widget.title} metric={widget.metric ?? "total_depth"} data={props.data} />;
  }
  if (widget.type === "logWidget") {
    return <LogWidget data={withRuntimeLogWidget(props.data, widgetId, widget)} />;
  }
  if (widget.type === "validationPanel") {
    return <ValidationWidget {...props} />;
  }
  if (widget.type === "aiWorkflow") {
    return (
      <RuntimeWidgetFrame title={widget.title}>
        <AiWorkflowPanel
          summary={props.aiSummary}
          provider={props.aiProvider}
          suggestions={props.data.ai_suggestions}
          generating={props.aiGenerating}
          acting={props.aiActing}
          onGenerate={props.onGenerateAi}
          onAccept={props.onAcceptSuggestion}
          onReject={props.onRejectSuggestion}
        />
      </RuntimeWidgetFrame>
    );
  }
  if (widget.type === "exportPanel") {
    return (
      <RuntimeWidgetFrame title={widget.title}>
        <ExportPanel
          data={props.data}
          readiness={props.exportReadiness}
          jobs={props.exportJobs}
          creating={props.exportCreating}
          approving={props.exportApproving}
          onCreate={props.onCreateExport}
          onApprove={props.onApproveExport}
        />
      </RuntimeWidgetFrame>
    );
  }
  if (widget.type === "curveCatalog") {
    return <CurveCatalogWidget title={widget.title} data={props.data} />;
  }
  if (widget.type === "intervalDetails") {
    return <IntervalDetailsWidget title={widget.title} {...props} />;
  }
  return (
    <RuntimeWidgetFrame title={widget.title}>
      <div className="empty">No runtime renderer is registered for {widget.type}.</div>
    </RuntimeWidgetFrame>
  );
}

function CurveCatalogWidget({ title, data }: { title: string; data: BoreholeWorkbench }) {
  return (
    <RuntimeWidgetFrame title={title}>
      <div className="curve-catalog">
        {data.curves.map((curve) => {
          const depths = curve.samples.map((sample) => sample.depth);
          const values = curve.samples.map((sample) => sample.value);
          const fromDepth = depths.length ? Math.min(...depths) : null;
          const toDepth = depths.length ? Math.max(...depths) : null;
          const min = values.length ? Math.min(...values) : null;
          const max = values.length ? Math.max(...values) : null;
          return (
            <article key={curve.id} className="curve-catalog-item">
              <i style={{ background: curve.color }} />
              <div>
                <strong>{curve.label}</strong>
                <span>
                  {curve.unit || "-"} · {curve.source_type.replaceAll("_", " ")}
                </span>
                <small>
                  {fromDepth !== null && toDepth !== null
                    ? `${fromDepth.toFixed(1)}-${toDepth.toFixed(1)}m`
                    : "no coverage"}{" "}
                  · {curve.samples.length} samples
                </small>
              </div>
              <b>
                {min !== null && max !== null ? `${min.toFixed(1)} / ${max.toFixed(1)}` : "-"}
              </b>
            </article>
          );
        })}
        {!data.curves.length && <div className="empty">No curves imported for this borehole.</div>}
      </div>
    </RuntimeWidgetFrame>
  );
}

function RuntimeWidgetFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="runtime-widget-header">
        <strong>{title}</strong>
      </div>
      <div className="runtime-widget-body">{children}</div>
    </>
  );
}

function SingleValueWidget({
  title,
  metric,
  data,
}: {
  title: string;
  metric: string;
  data: BoreholeWorkbench;
}) {
  const value = metricValue(metric, data);
  return (
    <div className="runtime-kpi">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ValidationWidget(props: Props) {
  const errors = props.data.validation_issues.filter((issue) => issue.severity === "error").length;
  const warnings = props.data.validation_issues.filter((issue) => issue.severity === "warning").length;
  const info = props.data.validation_issues.filter((issue) => issue.severity === "info").length;
  return (
    <RuntimeWidgetFrame title="Validation">
      <button
        type="button"
        className="full-width-action"
        disabled={props.validationRunning}
        onClick={props.onRunValidation}
      >
        {props.validationRunning ? "Running validation..." : "Run validation"}
      </button>
      <div className="validation-summary">
        <span>{errors} errors</span>
        <span>{warnings} warnings</span>
        <span>{info} info</span>
      </div>
      <div className="validation-list">
        {props.data.validation_issues.slice(0, 8).map((issue) => (
          <button
            key={issue.id}
            type="button"
            className={`validation-item ${issue.severity}`}
            onClick={() => {
              if (issue.from_depth !== null) {
                useWorkbenchStore.getState().setSelectedDepth(issue.from_depth);
              }
            }}
          >
            <strong>{issue.severity}</strong>
            <span>{issue.message}</span>
          </button>
        ))}
      </div>
    </RuntimeWidgetFrame>
  );
}

function IntervalDetailsWidget({ title, ...props }: Props & { title: string }) {
  const interval = props.selectedInterval;
  const selectedDepth = useWorkbenchStore((state) => state.selectedDepth);
  const boreholeMetadata = buildBoreholeMetadata(props.data);
  const [editorOpen, setEditorOpen] = useState(false);
  return (
    <>
      <RuntimeWidgetFrame title={title}>
        {!interval && <div className="empty">Select an interval or curve point.</div>}
        {interval && (
          <>
            <div className="interval-card">
              <small>
                Ruler depth {selectedDepth !== null ? `${selectedDepth.toFixed(2)} m` : "-"} · containing interval
              </small>
              <strong>
                {interval.from_depth} m - {interval.to_depth} m
              </strong>
              <span>
                {interval.lithology_code} · {interval.lithology_label}
              </span>
              <small>Source row {interval.source_row ?? "-"}</small>
            </div>
            <div className="field-grid">
              <MetadataField label="Thickness" value={`${(interval.to_depth - interval.from_depth).toFixed(2)} m`} />
              <MetadataField label="Logged color" value={interval.logged_color || "-"} />
              <MetadataField label="Seam" value={interval.seam_name || "-"} />
              <MetadataField
                label="Recovery"
                value={`${interval.recovery ?? "-"} m ${interval.recovery_percent ? `(${interval.recovery_percent}%)` : ""}`}
              />
              <MetadataField label="RQD" value={interval.rqd !== null ? `${Math.round(interval.rqd * 100)}%` : "-"} />
              <MetadataField label="Core box" value={props.selectedCoreImage ? `Box ${props.selectedCoreImage.box_number}` : "-"} />
              <MetadataField label="Features" value={interval.structural_features || "-"} full />
              <MetadataField label="Remarks" value={interval.remark || "-"} full />
              <MetadataField
                label="Source"
                value={`${props.data.source_workbook || "-"} · sheet ${props.data.source_sheet || "-"} · row ${interval.source_row ?? "-"}`}
                full
              />
            </div>
            {props.selectedCoreImage && (
              <button
                type="button"
                className="core-preview"
                onClick={() => props.onSelectImage(props.selectedCoreImage!)}
              >
                <img src={props.selectedCoreImage.url} alt={`Corebox ${props.selectedCoreImage.box_number}`} />
                <span>
                  Corebox {props.selectedCoreImage.box_number} · {props.selectedCoreImage.from_depth} m -{" "}
                  {props.selectedCoreImage.to_depth} m
                </span>
              </button>
            )}
            <div className="interval-actions">
              <button type="button" onClick={() => setEditorOpen(true)}>
                Edit correction
              </button>
            </div>
            <details className="metadata-collapsible">
              <summary>Borehole metadata</summary>
              <div className="field-grid metadata-grid">
                {boreholeMetadata.map((item) => (
                  <MetadataField key={item.label} label={item.label} value={item.value} />
                ))}
              </div>
            </details>
          </>
        )}
      </RuntimeWidgetFrame>
      {interval && editorOpen && (
        <FloatingIntervalEditor
          interval={interval}
          intervalSaving={props.intervalSaving}
          onClose={() => setEditorOpen(false)}
          onSaveInterval={(patch) => {
            props.onSaveInterval(patch);
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
}

function FloatingIntervalEditor({
  interval,
  intervalSaving,
  onClose,
  onSaveInterval,
}: {
  interval: LithologyInterval;
  intervalSaving: boolean;
  onClose: () => void;
  onSaveInterval: (patch: Partial<LithologyInterval>) => void;
}) {
  const [position, setPosition] = useState({ x: 520, y: 96 });
  const dragOffset = useRef<{ x: number; y: number } | null>(null);

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    dragOffset.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: PointerEvent<HTMLElement>) => {
    if (!dragOffset.current) return;
    const nextX = Math.max(12, Math.min(window.innerWidth - 380, event.clientX - dragOffset.current.x));
    const nextY = Math.max(72, Math.min(window.innerHeight - 180, event.clientY - dragOffset.current.y));
    setPosition({ x: nextX, y: nextY });
  };

  const stopDrag = (event: PointerEvent<HTMLElement>) => {
    dragOffset.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <aside className="floating-interval-editor" style={{ left: position.x, top: position.y }}>
      <header
        className="floating-interval-editor-header"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <div>
          <strong>Correction edit</strong>
          <span>
            {interval.from_depth} m - {interval.to_depth} m · {interval.lithology_code ?? "interval"}
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close correction editor">
          x
        </button>
      </header>
      <form
        key={interval.id}
        className="edit-form floating-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onSaveInterval({
            from_depth: parseOptionalNumber(form.get("from_depth")),
            to_depth: parseOptionalNumber(form.get("to_depth")),
            lithology_code: String(form.get("lithology_code")),
            lithology_label: String(form.get("lithology_label")),
            logged_color: String(form.get("logged_color") || ""),
            seam_name: String(form.get("seam_name") || ""),
            recovery: parseOptionalNumber(form.get("recovery")),
            recovery_percent: parseOptionalNumber(form.get("recovery_percent")),
            rqd: parseOptionalPercent(form.get("rqd_percent")),
            structural_features: String(form.get("structural_features") || ""),
            remark: String(form.get("remark") || ""),
          });
        }}
      >
        <div className="edit-form-grid">
          <label>
            From depth
            <input name="from_depth" defaultValue={interval.from_depth} inputMode="decimal" />
          </label>
          <label>
            To depth
            <input name="to_depth" defaultValue={interval.to_depth} inputMode="decimal" />
          </label>
          <label>
            Lithology code
            <input name="lithology_code" defaultValue={interval.lithology_code ?? ""} />
          </label>
          <label>
            Lithology label
            <input name="lithology_label" defaultValue={interval.lithology_label} />
          </label>
          <label>
            Logged color
            <input name="logged_color" defaultValue={interval.logged_color ?? ""} />
          </label>
          <label>
            Seam
            <input name="seam_name" defaultValue={interval.seam_name ?? ""} />
          </label>
          <label>
            Recovery m
            <input name="recovery" defaultValue={interval.recovery ?? ""} inputMode="decimal" />
          </label>
          <label>
            Recovery %
            <input name="recovery_percent" defaultValue={interval.recovery_percent ?? ""} inputMode="decimal" />
          </label>
          <label>
            RQD %
            <input
              name="rqd_percent"
              defaultValue={interval.rqd !== null ? Math.round(interval.rqd * 100) : ""}
              inputMode="decimal"
            />
          </label>
        </div>
        <label>
          Structural features
          <textarea name="structural_features" defaultValue={interval.structural_features ?? ""} />
        </label>
        <label>
          Remarks
          <textarea name="remark" defaultValue={interval.remark ?? ""} />
        </label>
        <div className="floating-editor-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={intervalSaving}>
            {intervalSaving ? "Saving..." : "Save correction"}
          </button>
        </div>
      </form>
    </aside>
  );
}

function parseOptionalNumber(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalPercent(value: FormDataEntryValue | null): number | undefined {
  const parsed = parseOptionalNumber(value);
  return parsed === undefined ? undefined : parsed / 100;
}

function buildBoreholeMetadata(data: BoreholeWorkbench) {
  const excelImport = data.source_imports.find((item) => item.import_type === "excel");
  const metadata = (excelImport?.summary?.metadata ?? {}) as Record<string, unknown>;
  const sourceDepthText = Array.isArray(metadata.source_depth_text)
    ? metadata.source_depth_text
        .map((item) =>
          typeof item === "object" && item !== null && "text" in item
            ? String((item as { text?: unknown }).text ?? "")
            : "",
        )
        .filter(Boolean)
        .join(" | ")
    : "";

  return [
    { label: "Borehole", value: data.code || "-" },
    { label: "State", value: data.state || "-" },
    { label: "Block", value: String(metadata.block ?? data.source_sheet ?? "-") },
    { label: "Latitude", value: String(metadata.latitude ?? "-") },
    { label: "Departure", value: String(metadata.departure ?? "-") },
    { label: "Reduced level", value: String(metadata.reduced_level ?? metadata.rl ?? "-") },
    { label: "Water level", value: String(metadata.water_level ?? "-") },
    { label: "Total depth", value: `${data.total_depth} m` },
    { label: "Status/depth text", value: sourceDepthText || data.closure_note || "-" },
    { label: "Source workbook", value: data.source_workbook || "-" },
  ];
}

function MetadataField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function metricValue(metric: string, data: BoreholeWorkbench) {
  if (metric === "interval_count") return String(data.lithology_intervals.length);
  if (metric === "curve_count") return String(data.curves.length);
  if (metric === "corebox_count") return String(data.core_images.length);
  if (metric === "total_depth") return `${data.total_depth} m`;
  return "-";
}

function withRuntimeLogWidget(
  data: BoreholeWorkbench,
  widgetId: string,
  widget: NonNullable<DisplayLayout["settings"]["widgets"]>[string],
): BoreholeWorkbench {
  if (widgetId === "log-widget") return data;
  if (!data.layout) return data;
  const layout = structuredClone(data.layout);
  layout.settings.widgets = { ...(layout.settings.widgets ?? {}), "log-widget": widget };
  return { ...data, layout };
}
