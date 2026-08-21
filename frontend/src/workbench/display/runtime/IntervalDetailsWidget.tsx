import { useEffect, useMemo, useState } from "react";

import { useWorkbenchStore } from "../workbenchStore";
import { FloatingIntervalEditor } from "./FloatingIntervalEditor";
import { buildBoreholeMetadata, MetadataField } from "./intervalMetadata";
import { RuntimeWidgetFrame } from "./RuntimeWidgetFrame";
import type { DisplayRuntimeProps } from "./runtimeTypes";

function metadataText(attributes: Record<string, unknown> | null | undefined, key: string): string {
  const value = attributes?.[key];
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function auditFieldSummary(audit: { after_values: Record<string, unknown> }): string {
  const fields = Object.keys(audit.after_values).filter((field) => field !== "attributes");
  return fields.length ? fields.join(", ") : "metadata";
}

export function IntervalDetailsWidget({ title, ...props }: DisplayRuntimeProps & { title: string }) {
  const selectedDepth = useWorkbenchStore((state) => state.selectedDepth);
  const setSelectedInterval = useWorkbenchStore((state) => state.setSelectedInterval);
  const intervalAtDepth = useMemo(() => {
    if (selectedDepth === null) return null;
    return (
      props.data.lithology_intervals.find(
        (item) => item.from_depth <= selectedDepth && selectedDepth < item.to_depth,
      ) ??
      props.data.lithology_intervals.find(
        (item) => item.from_depth <= selectedDepth && item.to_depth >= selectedDepth,
      ) ??
      null
    );
  }, [props.data.lithology_intervals, selectedDepth]);
  const coreImageAtDepth = useMemo(() => {
    if (selectedDepth === null) return null;
    return (
      props.data.core_images.find(
        (image) =>
          image.from_depth !== null &&
          image.to_depth !== null &&
          image.from_depth <= selectedDepth &&
          image.to_depth >= selectedDepth,
      ) ?? null
    );
  }, [props.data.core_images, selectedDepth]);
  const interval = selectedDepth !== null ? intervalAtDepth : props.selectedInterval;
  const coreImage = selectedDepth !== null ? coreImageAtDepth : props.selectedCoreImage;
  const correctionAudits = useMemo(
    () => (interval ? (props.data.correction_audits ?? []).filter((audit) => audit.interval_id === interval.id) : []),
    [interval, props.data.correction_audits],
  );
  const boreholeMetadata = buildBoreholeMetadata(props.data);
  const [editorOpen, setEditorOpen] = useState(false);

  useEffect(() => {
    if (selectedDepth === null || props.selectedInterval?.id === intervalAtDepth?.id) return;
    setSelectedInterval(intervalAtDepth);
  }, [intervalAtDepth, props.selectedInterval?.id, selectedDepth, setSelectedInterval]);

  return (
    <>
      <RuntimeWidgetFrame title={title}>
        {!interval && (
          <div className="empty">
            {selectedDepth !== null
              ? `No lithology interval at ${selectedDepth.toFixed(2)} m.`
              : "Select an interval or curve point."}
          </div>
        )}
        {interval && (
          <>
            <div className="interval-card">
              <small>
                {selectedDepth !== null ? `Ruler depth ${selectedDepth.toFixed(2)} m` : "Selected interval"} ·{" "}
                {selectedDepth !== null ? "containing interval" : "stored selection"}
              </small>
              <strong>
                {interval.from_depth} m - {interval.to_depth} m
              </strong>
              <span>
                {interval.lithology_code} · {interval.lithology_label}
              </span>
              <small>
                {metadataText(interval.attributes, "data_stage_label")} · source row {interval.source_row ?? "-"}
              </small>
            </div>
            <div className="field-grid">
              <MetadataField label="Thickness" value={`${(interval.to_depth - interval.from_depth).toFixed(2)} m`} />
              <MetadataField label="Data stage" value={metadataText(interval.attributes, "data_stage_label")} />
              <MetadataField label="Stage source" value={metadataText(interval.attributes, "stage_source_type")} />
              <MetadataField label="Logged color" value={interval.logged_color || "-"} />
              <MetadataField label="Seam" value={interval.seam_name || "-"} />
              <MetadataField
                label="Recovery"
                value={`${interval.recovery ?? "-"} m ${interval.recovery_percent ? `(${interval.recovery_percent}%)` : ""}`}
              />
              <MetadataField label="RQD" value={interval.rqd !== null ? `${Math.round(interval.rqd * 100)}%` : "-"} />
              <MetadataField label="Core box" value={coreImage ? `Box ${coreImage.box_number}` : "-"} />
              <MetadataField label="Features" value={interval.structural_features || "-"} full />
              <MetadataField label="Remarks" value={interval.remark || "-"} full />
              <MetadataField
                label="Source"
                value={`${props.data.source_workbook || "-"} · sheet ${props.data.source_sheet || "-"} · row ${interval.source_row ?? "-"}`}
                full
              />
            </div>
            {coreImage && (
              <button
                type="button"
                className="core-preview"
                onClick={() => props.onSelectImage(coreImage)}
              >
                <img src={coreImage.url} alt={`Corebox ${coreImage.box_number}`} />
                <span>
                  Corebox {coreImage.box_number} · {coreImage.from_depth} m - {coreImage.to_depth} m
                </span>
              </button>
            )}
            <div className="interval-actions">
              <button
                type="button"
                onClick={() => {
                  setSelectedInterval(interval);
                  setEditorOpen(true);
                }}
              >
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
            <details className="metadata-collapsible">
              <summary>Correction history</summary>
              {correctionAudits.length === 0 && <div className="empty compact-empty">No saved corrections for this interval.</div>}
              {correctionAudits.slice(0, 5).map((audit) => (
                <div key={audit.id} className="audit-row">
                  <strong>{auditFieldSummary(audit)}</strong>
                  <span>
                    {audit.changed_by} · {formatAuditTime(audit.changed_at)}
                  </span>
                </div>
              ))}
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
            props.onSaveInterval(interval.id, patch);
            setEditorOpen(false);
          }}
        />
      )}
    </>
  );
}
