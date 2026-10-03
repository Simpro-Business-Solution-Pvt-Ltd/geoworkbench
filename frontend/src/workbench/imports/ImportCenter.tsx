import { useEffect, useState, type FormEvent } from "react";

import type { BoreholeWorkbench, ImportProfile, SourceFile } from "../../api/types";
import { sourceFileAuditFacts, sourceImportAuditFacts } from "./importAuditFacts";
import { sourceFileWorkflow } from "./importWorkflowModel";
import { TemplateEditorDialog, type TemplateSavePayload } from "./TemplateEditorDialog";

type TemplateEditorTarget = {
  profile: ImportProfile | null;
  seedMapping?: Record<string, unknown> | null;
  seedName?: string;
};

type Props = {
  data: BoreholeWorkbench;
  importProfiles?: ImportProfile[];
  registering: boolean;
  uploading: boolean;
  processing: boolean;
  importing: boolean;
  merging: boolean;
  savingProfile: boolean;
  onRegisterSourceFile: (payload: {
    file_type: string;
    original_name: string;
    storage_path?: string;
    file_metadata?: Record<string, unknown>;
  }) => void;
  onUploadSourceFile: (payload: { file_type: string; file: File }) => void;
  onProcessSourceFile: (sourceFileId: number) => void;
  onImportBoreholeFile: (sourceFileId: number) => void;
  onMergeSourceFile: (
    sourceFileId: number,
    options?: {
      interval_mode?: string;
      curve_mode?: string;
      from_depth?: number | null;
      to_depth?: number | null;
      source_borehole_code?: string | null;
    },
  ) => void;
  canManageTemplates: boolean;
  archivingProfile: boolean;
  profileError: string | null;
  /** Last failed import/merge/process action, shown above the queue. */
  actionError: string | null;
  onDismissActionError: () => void;
  onSaveTemplate: (payload: TemplateSavePayload, onSaved: () => void) => void;
  onArchiveTemplate: (profileId: number, archived: boolean) => void;
  onOpenWorkbench: () => void;
};

const IMPORT_STEPS = [
  "Upload or register",
  "Detect template",
  "Preview mapping",
  "Validate quality",
  "Confirm merge",
  "Audit changes",
];

export function ImportCenter({
  data,
  importProfiles,
  registering,
  uploading,
  processing,
  importing,
  merging,
  savingProfile,
  onRegisterSourceFile,
  onUploadSourceFile,
  onProcessSourceFile,
  onImportBoreholeFile,
  onMergeSourceFile,
  canManageTemplates,
  archivingProfile,
  profileError,
  actionError,
  onDismissActionError,
  onSaveTemplate,
  onArchiveTemplate,
  onOpenWorkbench,
}: Props) {
  const [editorTarget, setEditorTarget] = useState<TemplateEditorTarget | null>(null);
  const [mergeSource, setMergeSource] = useState<SourceFile | null>(null);
  const [templatePage, setTemplatePage] = useState(0);
  // Keep the open editor in sync with the latest saved profile (e.g. after archive).
  const editorProfile = editorTarget?.profile
    ? (importProfiles?.find((profile) => profile.id === editorTarget.profile?.id) ?? editorTarget.profile)
    : null;
  const templateCards = (importProfiles ?? []).map((profile) => ({ type: "profile" as const, profile }));
  const templatePageSize = 4;
  const templatePageCount = Math.max(1, Math.ceil(templateCards.length / templatePageSize));
  const safeTemplatePage = Math.min(templatePage, templatePageCount - 1);
  const visibleTemplateCards = templateCards.slice(
    safeTemplatePage * templatePageSize,
    safeTemplatePage * templatePageSize + templatePageSize,
  );
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fileType = String(form.get("file_type") || "excel");
    const file = form.get("file");
    if (file instanceof File && file.name) {
      onUploadSourceFile({ file_type: fileType, file });
      event.currentTarget.reset();
      return;
    }
    const fileName = String(form.get("original_name") || "").trim();
    if (fileName) {
      onRegisterSourceFile({ file_type: fileType, original_name: fileName });
      event.currentTarget.reset();
    }
  };

  return (
    <section className="workflow-center import-center">
      <div className="workflow-center-header">
        <div>
          <span>Import Center</span>
          <h1>{data.code} source package</h1>
        </div>
        <button type="button" onClick={onOpenWorkbench}>
          Open workbench
        </button>
      </div>

      <div className="workflow-flow">
        {IMPORT_STEPS.map((step, index) => (
          <div key={step} className="workflow-flow-step">
            <b>{index + 1}</b>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div className="workflow-center-grid">
        <section className="workflow-panel primary">
          <div className="workflow-panel-header">
            <strong>Register Source</strong>
            <span>{uploading ? "Uploading..." : registering ? "Registering..." : "Ready"}</span>
          </div>
          <form className="import-upload-form" onSubmit={submit}>
            <label>
              Source type
              <select name="file_type" defaultValue="excel">
                <option value="excel">Excel lithology workbook</option>
                <option value="las">LAS geophysical log</option>
                <option value="geophysical_pdf">Geophysical PDF</option>
                <option value="images">Corebox image batch</option>
                <option value="mobile_form">Mobile interval form</option>
              </select>
            </label>
            <label>
              Upload file
              <input name="file" type="file" />
            </label>
            <label>
              Or register filename
              <input name="original_name" placeholder="e.g. CTSJ-02 P-27 COMPOSITE.las" />
            </label>
            <button type="submit" disabled={uploading || registering}>
              {uploading || registering ? "Adding source..." : "Add source"}
            </button>
          </form>
        </section>

        <section className="workflow-panel template-registry-panel">
          <div className="workflow-panel-header">
            <strong>Template Registry</strong>
            <span>
              {importProfiles?.length ?? 0} profiles · page {safeTemplatePage + 1}/{templatePageCount}
            </span>
            {canManageTemplates && (
              <button type="button" className="template-new-button" onClick={() => setEditorTarget({ profile: null })}>
                + New template
              </button>
            )}
            {templatePageCount > 1 && (
              <div className="workflow-panel-pager">
                <button
                  type="button"
                  disabled={safeTemplatePage === 0}
                  onClick={() => setTemplatePage(safeTemplatePage - 1)}
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safeTemplatePage >= templatePageCount - 1}
                  onClick={() => setTemplatePage(safeTemplatePage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
          <div className="template-list">
            {visibleTemplateCards.map((item) => (
              <button
                type="button"
                key={`profile:${item.profile.id}`}
                className={`template-card ${editorProfile?.id === item.profile.id ? "selected" : ""} ${
                  item.profile.mapping?.status === "archived" ? "planned" : ""
                }`}
                onClick={() => setEditorTarget({ profile: item.profile })}
              >
                <strong>{item.profile.name}</strong>
                <span>{templateCardTag(item.profile)}</span>
                <small>{item.profile.description ?? "Mapping profile"}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="workflow-panel wide">
          <div className="workflow-panel-header">
            <strong>Source Queue</strong>
            <span>{data.source_files.length} files</span>
          </div>
          {actionError && (
            <div className="import-action-error" role="alert">
              <span>{actionError}</span>
              <button type="button" onClick={onDismissActionError}>
                Dismiss
              </button>
            </div>
          )}
          <div className="workflow-table">
            {data.source_files.map((item) => {
              const workflow = sourceFileWorkflow(item);
              return (
                <article key={item.id} className="workflow-row">
                  <div>
                    <strong>{item.original_name}</strong>
                    <span>
                      {item.file_type} · {item.status}
                    </span>
                    <ImportAuditFacts facts={sourceFileAuditFacts(item)} />
                  </div>
                  <small className={`source-next-step ${workflow.tone}`}>
                    <b>{workflow.nextStep}</b>
                    {workflow.detail}
                  </small>
                  <div className="workflow-row-actions">
                    <button
                      type="button"
                      disabled={processing || !workflow.canProcess}
                      onClick={() => onProcessSourceFile(item.id)}
                    >
                      {processing ? "Processing..." : workflow.canProcess ? "Process" : "Processed"}
                    </button>
                    <button
                      type="button"
                      disabled={merging || !workflow.canMerge}
                      onClick={() => setMergeSource(item)}
                    >
                      {item.status === "merged" ? "Merged" : merging ? "Merging..." : "Merge"}
                    </button>
                    {item.file_type === "excel" && (
                      <button type="button" disabled={importing} onClick={() => onImportBoreholeFile(item.id)}>
                        Import borehole
                      </button>
                    )}
                  </div>
                  <SourceFileDiagnostics item={item} />
                </article>
              );
            })}
            {!data.source_files.length && <div className="empty">No source files received for this borehole.</div>}
          </div>
        </section>

        <section className="workflow-panel">
          <div className="workflow-panel-header">
            <strong>Parsed Imports</strong>
            <span>{data.source_imports.length} batches</span>
          </div>
          <div className="workflow-mini-list">
            {data.source_imports.map((item) => (
              <article key={item.id}>
                <strong>{item.import_type.replaceAll("_", " ")}</strong>
                <span>{item.status}</span>
                <small>{item.source_name}</small>
                <ImportAuditFacts facts={sourceImportAuditFacts(item)} />
              </article>
            ))}
            {!data.source_imports.length && <div className="empty">No parsed import batches yet.</div>}
          </div>
        </section>

        <section className="workflow-panel">
          <div className="workflow-panel-header">
            <strong>Mobile Submissions</strong>
            <span>{data.field_submissions.length} batches</span>
          </div>
          <div className="workflow-mini-list">
            {data.field_submissions.map((item) => (
              <article key={item.id}>
                <strong>{item.submission_type.replaceAll("_", " ")}</strong>
                <span>{item.status}</span>
                <small>{item.submitted_by ?? "field user"}</small>
              </article>
            ))}
            {!data.field_submissions.length && <div className="empty">No mobile submissions yet.</div>}
          </div>
        </section>
      </div>
      {editorTarget && (
        <TemplateEditorDialog
          key={editorTarget.profile ? `profile-${editorTarget.profile.id}` : `new-${editorTarget.seedName ?? ""}`}
          profile={editorProfile}
          seedMapping={editorTarget.seedMapping}
          seedName={editorTarget.seedName}
          canManage={canManageTemplates}
          saving={savingProfile}
          archiving={archivingProfile}
          saveError={profileError}
          defaultBoreholeCode={data.code}
          onClose={() => setEditorTarget(null)}
          onSave={(payload) => onSaveTemplate(payload, () => setEditorTarget(null))}
          onArchive={onArchiveTemplate}
          onDuplicate={(profile) =>
            setEditorTarget({
              profile: null,
              seedMapping: { ...profile.mapping, version: undefined, status: undefined },
              seedName: `${profile.name} copy`,
            })
          }
        />
      )}
      {mergeSource && (
        <MergeOptionsDialog
          sourceFile={mergeSource}
          boreholeCode={data.code}
          merging={merging}
          onClose={() => setMergeSource(null)}
          onMerge={(options) => {
            onMergeSourceFile(mergeSource.id, options);
            setMergeSource(null);
          }}
        />
      )}
    </section>
  );
}

function MergeOptionsDialog({
  sourceFile,
  boreholeCode,
  merging,
  onClose,
  onMerge,
}: {
  sourceFile: SourceFile;
  boreholeCode: string;
  merging: boolean;
  onClose: () => void;
  onMerge: (options: {
    interval_mode?: string;
    curve_mode?: string;
    from_depth?: number | null;
    to_depth?: number | null;
    source_borehole_code?: string | null;
  }) => void;
}) {
  const isIntervalSource = sourceFile.file_type === "excel" || sourceFile.original_name.toLowerCase().endsWith(".xlsx");
  const isCurveSource =
    sourceFile.file_type === "las" ||
    sourceFile.file_type === "geophysical_pdf" ||
    sourceFile.original_name.toLowerCase().endsWith(".las") ||
    sourceFile.original_name.toLowerCase().endsWith(".pdf");
  const parseSummary = sourceFile.file_metadata?.parse_summary as Record<string, unknown> | undefined;
  const summary = parseSummary?.summary as Record<string, unknown> | undefined;
  // Registry templates can hold many boreholes; let the user pick whose rows to load.
  const fileBoreholeCounts = parseSummary?.registry_template
    ? Object.entries((summary?.borehole_row_counts as Record<string, number> | undefined) ?? {})
    : [];
  const matchingCode = fileBoreholeCounts.find(([code]) => code.toUpperCase() === boreholeCode.toUpperCase())?.[0];
  const [sourceBoreholeCode, setSourceBoreholeCode] = useState(matchingCode ?? fileBoreholeCounts[0]?.[0] ?? "");
  const defaultFrom = numberOrBlank(summary?.min_depth);
  const defaultTo = numberOrBlank(summary?.max_depth);
  const [intervalMode, setIntervalMode] = useState("replace_overlapping_range");
  const [curveMode, setCurveMode] = useState("replace_curves_by_key");
  const [fromDepth, setFromDepth] = useState(defaultFrom);
  const [toDepth, setToDepth] = useState(defaultTo);

  return (
    <div className="mapping-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="merge-dialog">
        <header>
          <div>
            <strong>Merge Source</strong>
            <span>{sourceFile.original_name}</span>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="merge-dialog-body">
          {fileBoreholeCounts.length > 0 && (
            <label>
              Rows from file borehole
              <select
                value={sourceBoreholeCode}
                onChange={(event) => {
                  setSourceBoreholeCode(event.target.value);
                  // The processed depth range belongs to the selected borehole; reset to "whole range".
                  setFromDepth("");
                  setToDepth("");
                }}
              >
                {fileBoreholeCounts.map(([code, count]) => (
                  <option key={code} value={code}>
                    {code} · {count} rows{code === matchingCode ? " (matches this borehole)" : ""}
                  </option>
                ))}
              </select>
              <small className="template-editor-hint">
                Loads only this borehole's rows into {boreholeCode}. Leave the depths blank for its whole range.
              </small>
            </label>
          )}
          {isIntervalSource && (
            <label>
              Interval merge
              <select value={intervalMode} onChange={(event) => setIntervalMode(event.target.value)}>
                <option value="replace_overlapping_range">Replace overlapping depth range</option>
                <option value="append_new_depths">Append only new depth rows</option>
              </select>
            </label>
          )}
          {isCurveSource && (
            <label>
              Curve merge
              <select value={curveMode} onChange={(event) => setCurveMode(event.target.value)}>
                <option value="replace_curves_by_key">Replace curves with same key</option>
                <option value="append_new_curves">Append only new curves</option>
              </select>
            </label>
          )}
          {isIntervalSource && (
            <div className="export-depth-range">
              <label>
                From depth
                <input value={fromDepth} onChange={(event) => setFromDepth(event.target.value)} />
              </label>
              <label>
                To depth
                <input value={toDepth} onChange={(event) => setToDepth(event.target.value)} />
              </label>
            </div>
          )}
        </div>
        <footer className="merge-dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={merging}
            onClick={() =>
              onMerge({
                interval_mode: isIntervalSource ? intervalMode : undefined,
                curve_mode: isCurveSource ? curveMode : undefined,
                from_depth: isIntervalSource ? optionalNumber(fromDepth) : undefined,
                to_depth: isIntervalSource ? optionalNumber(toDepth) : undefined,
                source_borehole_code: fileBoreholeCounts.length ? sourceBoreholeCode || null : undefined,
              })
            }
          >
            {merging ? "Merging..." : "Apply merge"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function numberOrBlank(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function optionalNumber(value: string) {
  // Blank means "no limit". Number("") is 0, which would merge a 0-0 m range.
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function templateCardTag(profile: ImportProfile) {
  const type = profile.profile_type.replaceAll("_", " ");
  if (profile.builtin) return `${type} · built-in`;
  if (profile.mapping?.kind !== "tabular_intervals") return type;
  const archived = profile.mapping?.status === "archived" ? " · archived" : "";
  return `${type} · registry v${String(profile.mapping?.version ?? 1)}${archived}`;
}

function ImportAuditFacts({ facts }: { facts: Array<{ label: string; value: string }> }) {
  if (!facts.length) return null;
  return (
    <div className="import-audit-facts">
      {facts.map((fact) => (
        <small key={fact.label}>
          <b>{fact.label}</b> {fact.value}
        </small>
      ))}
    </div>
  );
}

function SourceFileDiagnostics({ item }: { item: SourceFile }) {
  const parseSummary = item.file_metadata?.parse_summary as Record<string, unknown> | undefined;
  const mergeSummary = item.file_metadata?.merge_summary as Record<string, unknown> | undefined;
  const summary = mergeSummary ?? parseSummary;
  if (!summary) return null;
  return (
    <details className="source-diagnostics">
      <summary>{mergeSummary ? "Merge result" : "Parse preview"}</summary>
      <DiagnosticRows summary={summary} />
    </details>
  );
}

function DiagnosticRows({ summary }: { summary: Record<string, unknown> }) {
  const template = valueText(nestedValue(summary, ["template", "key"]));
  const parser = valueText(summary.parser ?? summary.merge_mode);
  const message = valueText(summary.message);
  const error = valueText(summary.error);
  const rowCount = valueText(nestedValue(summary, ["summary", "lithology_interval_count"]) ?? summary.row_count);
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  return (
    <div className="diagnostic-grid">
      {parser && <span><b>Adapter</b>{parser}</span>}
      {template && <span><b>Template</b>{template}</span>}
      {rowCount && <span><b>Rows</b>{rowCount}</span>}
      {message && <span className="full"><b>Message</b>{message}</span>}
      {error && <span className="full warning"><b>Error</b>{error}</span>}
      {warnings.map((warning, index) => (
        <span key={`${warning}:${index}`} className="full warning"><b>Warning</b>{String(warning)}</span>
      ))}
    </div>
  );
}

function valueText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function nestedValue(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const item of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[item];
  }
  return current;
}
