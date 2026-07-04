import { useEffect, useState, type FormEvent } from "react";

import type { BoreholeWorkbench, ImportProfile, SourceFile } from "../../api/types";

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
    },
  ) => void;
  onSaveImportProfile: (payload: {
    profileId: number;
    name: string;
    description: string;
    mapping: Record<string, unknown>;
  }) => void;
  onOpenWorkbench: () => void;
};

const IMPORT_STEPS = [
  "Register source",
  "Detect template",
  "Parse and preview",
  "Validate",
  "Merge",
  "Audit",
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
  onSaveImportProfile,
  onOpenWorkbench,
}: Props) {
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<SourceFile | null>(null);
  const [templatePage, setTemplatePage] = useState(0);
  const selectedProfile =
    importProfiles?.find((profile) => profile.id === selectedProfileId) ?? importProfiles?.[0] ?? null;
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
                className={`template-card ${selectedProfile?.id === item.profile.id ? "selected" : ""}`}
                onClick={() => {
                  setSelectedProfileId(item.profile.id);
                  setMappingDialogOpen(true);
                }}
              >
                <strong>{item.profile.name}</strong>
                <span>{item.profile.profile_type.replaceAll("_", " ")}</span>
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
          <div className="workflow-table">
            {data.source_files.map((item) => (
              <article key={item.id} className="workflow-row">
                <div>
                  <strong>{item.original_name}</strong>
                  <span>
                    {item.file_type} · {item.status}
                  </span>
                </div>
                <small>{sourceFileStatusText(item)}</small>
                <div className="workflow-row-actions">
                  <button
                    type="button"
                    disabled={processing || item.status === "parsed"}
                    onClick={() => onProcessSourceFile(item.id)}
                  >
                    {item.status === "parsed" ? "Parsed" : "Process"}
                  </button>
                  <button
                    type="button"
                    disabled={merging || ["merged", "mapping_required"].includes(item.status)}
                    onClick={() => setMergeSource(item)}
                  >
                    {item.status === "merged" ? "Merged" : "Merge"}
                  </button>
                  {item.file_type === "excel" && (
                    <button type="button" disabled={importing} onClick={() => onImportBoreholeFile(item.id)}>
                      Import borehole
                    </button>
                  )}
                </div>
                <SourceFileDiagnostics item={item} />
              </article>
            ))}
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
      {mappingDialogOpen && selectedProfile && (
        <TemplateMappingDialog
          profile={selectedProfile}
          saving={savingProfile}
          onClose={() => setMappingDialogOpen(false)}
          onSave={onSaveImportProfile}
        />
      )}
      {mergeSource && (
        <MergeOptionsDialog
          sourceFile={mergeSource}
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
  merging,
  onClose,
  onMerge,
}: {
  sourceFile: SourceFile;
  merging: boolean;
  onClose: () => void;
  onMerge: (options: {
    interval_mode?: string;
    curve_mode?: string;
    from_depth?: number | null;
    to_depth?: number | null;
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
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function TemplateMappingDialog({
  profile,
  saving,
  onClose,
  onSave,
}: {
  profile: ImportProfile;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: {
    profileId: number;
    name: string;
    description: string;
    mapping: Record<string, unknown>;
  }) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description ?? "");
  const [mappingText, setMappingText] = useState(JSON.stringify(profile.mapping, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(profile.name);
    setDescription(profile.description ?? "");
    setMappingText(JSON.stringify(profile.mapping, null, 2));
    setError(null);
  }, [profile]);

  const save = () => {
    try {
      const mapping = JSON.parse(mappingText) as Record<string, unknown>;
      setError(null);
      onSave({ profileId: profile.id, name: name.trim(), description: description.trim(), mapping });
    } catch {
      setError("Mapping JSON is not valid.");
    }
  };

  return (
    <div className="mapping-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="mapping-dialog">
        <header>
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.profile_type.replaceAll("_", " ")}</span>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="mapping-dialog-body">
          <section className="template-mapping-preview import-profile-editor">
            <label>
              Template name
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Description
              <input value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Mapping JSON
              <textarea
                value={mappingText}
                spellCheck={false}
                onChange={(event) => setMappingText(event.target.value)}
              />
            </label>
            {error && <span className="mapping-error">{error}</span>}
            <div className="mapping-dialog-actions">
              <button type="button" onClick={save} disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save template"}
              </button>
            </div>
          </section>
          <TemplateMappingPreview profile={{ ...profile, name, description, mapping: safeMapping(mappingText) }} />
        </div>
      </div>
    </div>
  );
}

function safeMapping(mappingText: string): Record<string, unknown> {
  try {
    return JSON.parse(mappingText) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function TemplateMappingPreview({ profile }: { profile: ImportProfile }) {
  const mapping = profile.mapping ?? {};
  const lithology = typeof mapping.lithology === "object" && mapping.lithology !== null ? mapping.lithology : null;
  return (
    <div className="template-mapping-preview">
      <div className="workflow-panel-header compact">
        <strong>Mapping Preview</strong>
        <span>{String(mapping.template_key ?? mapping.status ?? profile.profile_type)}</span>
      </div>
      {lithology ? (
        <div className="mapping-grid">
          {Object.entries(lithology).map(([field, column]) => (
            <span key={field}>
              <b>{field.replaceAll("_", " ")}</b>
              <code>{String(column)}</code>
            </span>
          ))}
        </div>
      ) : (
        <pre>{JSON.stringify(mapping, null, 2)}</pre>
      )}
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
  const rowCount = valueText(nestedValue(summary, ["summary", "lithology_interval_count"]) ?? summary.row_count);
  const warnings = Array.isArray(summary.warnings) ? summary.warnings : [];
  return (
    <div className="diagnostic-grid">
      {parser && <span><b>Adapter</b>{parser}</span>}
      {template && <span><b>Template</b>{template}</span>}
      {rowCount && <span><b>Rows</b>{rowCount}</span>}
      {message && <span className="full"><b>Message</b>{message}</span>}
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

function sourceFileStatusText(item: SourceFile) {
  if (item.status === "mapping_required") return "column mapping required";
  if (item.status === "merge_pending_review") return "merge rules need review";
  if (item.status === "linked_pending_depth_mapping") return "depth mapping required";
  if (item.file_metadata?.parse_summary) return "profile available";
  return item.file_metadata ? "metadata captured" : "awaiting template metadata";
}
