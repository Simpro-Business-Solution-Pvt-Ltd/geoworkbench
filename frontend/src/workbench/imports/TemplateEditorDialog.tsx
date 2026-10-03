import { useEffect, useMemo, useState } from "react";

import { apiErrorMessage, inspectTemplateSample, testImportTemplate } from "../../api/client";
import type { ImportProfile, TemplateSampleInspection, TemplateTestResult } from "../../api/types";
import {
  FIELD_DEFS,
  NORMALIZE_OPTIONS,
  TEMPLATE_KIND,
  builderErrors,
  builderStateToMapping,
  emptyBuilderState,
  headersFromRow,
  mappingToBuilderState,
  suggestMapping,
  type NormalizeRule,
  type TemplateBuilderState,
} from "./templateBuilderModel";

const PREVIEW_COLUMNS = 18;

export type TemplateSavePayload = {
  profileId: number | null;
  name: string;
  description: string;
  mapping: Record<string, unknown>;
};

type Props = {
  /** null = new template. */
  profile: ImportProfile | null;
  /** Starting mapping for a new template (e.g. "Duplicate"). */
  seedMapping?: Record<string, unknown> | null;
  seedName?: string;
  canManage: boolean;
  saving: boolean;
  archiving: boolean;
  saveError: string | null;
  defaultBoreholeCode: string | null;
  onClose: () => void;
  onSave: (payload: TemplateSavePayload) => void;
  onArchive: (profileId: number, archived: boolean) => void;
  onDuplicate: (profile: ImportProfile) => void;
};

export function TemplateEditorDialog({
  profile,
  seedMapping,
  seedName,
  canManage,
  saving,
  archiving,
  saveError,
  defaultBoreholeCode,
  onClose,
  onSave,
  onArchive,
  onDuplicate,
}: Props) {
  const isTabular = profile ? profile.mapping?.kind === TEMPLATE_KIND : true;
  const readOnly = !canManage || Boolean(profile?.builtin) || !isTabular;
  const archived = profile?.mapping?.status === "archived";
  const startMapping = profile?.mapping ?? seedMapping ?? null;

  const [name, setName] = useState(profile?.name ?? seedName ?? "");
  const [description, setDescription] = useState(profile?.description ?? "");
  const [tab, setTab] = useState<"builder" | "json">(readOnly ? "json" : "builder");
  const [state, setState] = useState<TemplateBuilderState>(() =>
    startMapping ? mappingToBuilderState(startMapping) : emptyBuilderState(),
  );
  const [jsonText, setJsonText] = useState(() => JSON.stringify(startMapping ?? builderStateToMapping(state), null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [sample, setSample] = useState<TemplateSampleInspection | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [testCode, setTestCode] = useState(defaultBoreholeCode ?? "");
  const [testResult, setTestResult] = useState<TemplateTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setTestResult(null);
    setTestError(null);
  }, [state, jsonText]);

  const sheet = useMemo(() => {
    if (!sample?.sheets.length) return null;
    if (state.sheet === "first") return sample.sheets[0];
    return sample.sheets.find((item) => item.name.trim().toLowerCase() === state.sheet.trim().toLowerCase()) ?? null;
  }, [sample, state.sheet]);
  const headers = useMemo(() => (sheet ? headersFromRow(sheet.rows, state.headerRow) : []), [sheet, state.headerRow]);
  const errors = builderErrors(state);

  const update = (patch: Partial<TemplateBuilderState>) => setState((current) => ({ ...current, ...patch }));
  const updateField = (key: keyof TemplateBuilderState["fields"], value: string) =>
    setState((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));

  const switchTab = (next: "builder" | "json") => {
    if (next === tab) return;
    if (next === "json") {
      setJsonText(JSON.stringify(builderStateToMapping(state), null, 2));
      setJsonError(null);
      setTab("json");
      return;
    }
    try {
      setState(mappingToBuilderState(JSON.parse(jsonText) as Record<string, unknown>));
      setJsonError(null);
      setTab("builder");
    } catch {
      setJsonError("Fix the JSON before switching back to the builder.");
    }
  };

  const currentMapping = (): Record<string, unknown> | null => {
    if (tab === "builder") return builderStateToMapping(state);
    try {
      const parsed = JSON.parse(jsonText) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
      setJsonError(null);
      return parsed as Record<string, unknown>;
    } catch {
      setJsonError("Template JSON is not valid.");
      return null;
    }
  };

  const loadSample = async (file: File | null) => {
    setSampleFile(file);
    setSample(null);
    setSampleError(null);
    if (!file) return;
    setInspecting(true);
    try {
      const inspection = await inspectTemplateSample(file);
      setSample(inspection);
      const firstSheet = inspection.sheets[0];
      const sampleHeaders = firstSheet ? headersFromRow(firstSheet.rows, state.headerRow) : [];
      // Suggest a mapping only when nothing has been mapped yet, so edits are never overwritten.
      if (!profile && !state.depthFrom && !state.fields.lithology && sampleHeaders.length) {
        setState((current) => suggestMapping(sampleHeaders, current));
      }
    } catch (error) {
      setSampleError(apiErrorMessage(error));
    } finally {
      setInspecting(false);
    }
  };

  const pickHeaderRow = (rowNumber: number) => {
    const nextHeaders = sheet ? headersFromRow(sheet.rows, rowNumber) : [];
    setState((current) => {
      const next = { ...current, headerRow: rowNumber, dataStartRow: rowNumber + 1 };
      return nextHeaders.length ? suggestMapping(nextHeaders, next) : next;
    });
  };

  const runTest = async () => {
    const mapping = currentMapping();
    if (!mapping || !sampleFile) return;
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      setTestResult(await testImportTemplate(sampleFile, mapping, testCode.trim() || null));
    } catch (error) {
      setTestError(apiErrorMessage(error));
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    const mapping = currentMapping();
    if (!mapping) return;
    onSave({ profileId: profile?.id ?? null, name: name.trim(), description: description.trim(), mapping });
  };

  const title = profile ? profile.name : "New template";
  const subtitle = profile
    ? `${profile.builtin ? "Built-in layout · read-only" : `Registry template · v${String(profile.mapping?.version ?? 1)}`}${
        archived ? " · archived" : ""
      }`
    : "Describe a flat interval spreadsheet so it imports without code changes";
  const canSave = !readOnly && Boolean(name.trim()) && (tab === "json" || errors.length === 0);

  return (
    <div className="mapping-dialog-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mapping-dialog template-editor">
        <header>
          <div>
            <strong>{title}</strong>
            <span>{subtitle}</span>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="mapping-dialog-body template-editor-body">
          {readOnly && (
            <p className="template-editor-note">
              {profile?.builtin || !isTabular
                ? "This built-in layout is read by dedicated code and cannot be edited here. "
                : "Only a System Admin can edit templates. "}
              {canManage && isTabular && profile && "Use Duplicate to start a new template from it."}
            </p>
          )}

          <section className="import-profile-editor template-editor-identity">
            <label>
              Template name
              <input value={name} disabled={readOnly} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>
              Description
              <input value={description} disabled={readOnly} onChange={(event) => setDescription(event.target.value)} />
            </label>
          </section>

          {!readOnly && (
            <div className="template-editor-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={tab === "builder"} className={tab === "builder" ? "active" : ""} onClick={() => switchTab("builder")}>
                Builder
              </button>
              <button type="button" role="tab" aria-selected={tab === "json"} className={tab === "json" ? "active" : ""} onClick={() => switchTab("json")}>
                JSON
              </button>
            </div>
          )}

          {tab === "builder" && !readOnly && (
            <>
              <section className="template-editor-section">
                <h4>1. Sample file</h4>
                <p className="template-editor-hint">
                  Upload a real file in this layout. It is only read to show its rows and test the template; nothing is imported.
                </p>
                <input type="file" accept=".xlsx,.xlsm" onChange={(event) => void loadSample(event.target.files?.[0] ?? null)} />
                {inspecting && <span className="template-editor-hint">Reading sample…</span>}
                {sampleError && <span className="mapping-error">{sampleError}</span>}
                {sample && (
                  <>
                    <div className="template-editor-row">
                      <label>
                        Sheet
                        <select value={state.sheet} onChange={(event) => update({ sheet: event.target.value })}>
                          <option value="first">First sheet ({sample.sheets[0]?.name})</option>
                          {sample.sheets.map((item) => (
                            <option key={item.name} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="template-editor-hint">
                        Click the row that holds the column headers. Header row {state.headerRow} · data from row {state.dataStartRow}
                      </span>
                    </div>
                    {sheet && (
                      <div className="template-sample-grid">
                        <table>
                          <tbody>
                            {sheet.rows.map((row, index) => {
                              const rowNumber = index + 1;
                              const role =
                                rowNumber === state.headerRow ? "header" : rowNumber >= state.dataStartRow ? "data" : "skip";
                              return (
                                <tr key={rowNumber} className={`sample-${role}`} onClick={() => pickHeaderRow(rowNumber)} title="Use as header row">
                                  <th>{rowNumber}</th>
                                  {row.slice(0, PREVIEW_COLUMNS).map((cell, cellIndex) => (
                                    <td key={cellIndex}>{cell === null ? "" : String(cell)}</td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="template-editor-section">
                <h4>2. Borehole identity</h4>
                <div className="template-editor-choice">
                  <label>
                    <input
                      type="radio"
                      checked={state.boreholeSource === "column"}
                      onChange={() => update({ boreholeSource: "column" })}
                    />
                    Many boreholes in one sheet: the code is in a column
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={state.boreholeSource === "selected"}
                      onChange={() => update({ boreholeSource: "selected" })}
                    />
                    One borehole per file: load into the selected borehole
                  </label>
                </div>
                <div className="template-editor-row">
                  {state.boreholeSource === "column" && (
                    <ColumnPicker label="Borehole code column" value={state.boreholeColumn} headers={headers} required onChange={(value) => update({ boreholeColumn: value })} />
                  )}
                  <label>
                    Match codes
                    <select value={state.normalize} onChange={(event) => update({ normalize: event.target.value as NormalizeRule })}>
                      {NORMALIZE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="template-editor-section">
                <h4>3. Depth</h4>
                <div className="template-editor-choice">
                  <label>
                    <input type="radio" checked={state.depthMode === "to"} onChange={() => update({ depthMode: "to" })} />
                    From and To columns
                  </label>
                  <label>
                    <input type="radio" checked={state.depthMode === "thickness"} onChange={() => update({ depthMode: "thickness" })} />
                    From and Thickness columns
                  </label>
                </div>
                <div className="template-editor-row">
                  <ColumnPicker label="From depth (m)" value={state.depthFrom} headers={headers} required onChange={(value) => update({ depthFrom: value })} />
                  {state.depthMode === "to" ? (
                    <ColumnPicker label="To depth (m)" value={state.depthTo} headers={headers} required onChange={(value) => update({ depthTo: value })} />
                  ) : (
                    <ColumnPicker label="Thickness (m)" value={state.depthThickness} headers={headers} required onChange={(value) => update({ depthThickness: value })} />
                  )}
                </div>
              </section>

              <section className="template-editor-section">
                <h4>4. Columns</h4>
                <div className="template-editor-fields">
                  {FIELD_DEFS.map((field) => (
                    <ColumnPicker
                      key={field.key}
                      label={field.label}
                      value={state.fields[field.key]}
                      headers={headers}
                      required={field.required}
                      onChange={(value) => updateField(field.key, value)}
                    />
                  ))}
                  {[0, 1].map((index) => (
                    <ColumnPicker
                      key={`remark-${index}`}
                      label={index === 0 ? "Remarks" : "Remarks (2nd column, joined)"}
                      value={state.remarkColumns[index] ?? ""}
                      headers={headers}
                      onChange={(value) =>
                        setState((current) => {
                          const remarkColumns = [...current.remarkColumns];
                          remarkColumns[index] = value;
                          return { ...current, remarkColumns: remarkColumns.filter(Boolean) };
                        })
                      }
                    />
                  ))}
                  <label>
                    RQD values are
                    <select value={state.rqdUnit} onChange={(event) => update({ rqdUnit: event.target.value as "percent" | "fraction" })}>
                      <option value="percent">Percent (0–100)</option>
                      <option value="fraction">Fraction (0–1)</option>
                    </select>
                  </label>
                </div>
                {errors.length > 0 && (
                  <ul className="template-editor-errors">
                    {errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {(tab === "json" || readOnly) && (
            <section className="import-profile-editor">
              <label>
                Template JSON
                <textarea value={jsonText} spellCheck={false} readOnly={readOnly} onChange={(event) => setJsonText(event.target.value)} />
              </label>
              {jsonError && <span className="mapping-error">{jsonError}</span>}
              {!readOnly && (
                <span className="template-editor-hint">
                  Advanced: edit the template directly. Changes carry over to the Builder tab.
                </span>
              )}
            </section>
          )}

          {!readOnly && (
            <section className="template-editor-section">
              <h4>5. Test on the sample</h4>
              <div className="template-editor-row">
                <label>
                  Borehole code to test
                  <input value={testCode} placeholder="e.g. MGCA-08" onChange={(event) => setTestCode(event.target.value)} />
                </label>
                <button type="button" disabled={!sampleFile || testing || (tab === "builder" && errors.length > 0)} onClick={() => void runTest()}>
                  {testing ? "Testing…" : "Test template"}
                </button>
              </div>
              {!sampleFile && <span className="template-editor-hint">Upload a sample file (step 1) to test.</span>}
              {testError && <span className="mapping-error">{testError}</span>}
              {testResult && <TemplateTestSummary result={testResult} boreholeCode={testCode.trim()} />}
            </section>
          )}

          {saveError && <span className="mapping-error">{saveError}</span>}
          {!readOnly && !name.trim() && <span className="template-editor-hint">Enter a template name to save.</span>}
        </div>

        <footer className="merge-dialog-actions template-editor-actions">
          {profile && canManage && isTabular && !profile.builtin && (
            <button type="button" disabled={archiving} onClick={() => onArchive(profile.id, !archived)}>
              {archiving ? "Saving…" : archived ? "Restore template" : "Archive template"}
            </button>
          )}
          {profile && canManage && isTabular && (
            <button type="button" onClick={() => onDuplicate(profile)}>
              Duplicate
            </button>
          )}
          <span className="template-editor-spacer" />
          <button type="button" onClick={onClose}>
            {readOnly ? "Close" : "Cancel"}
          </button>
          {!readOnly && (
            <button type="button" className="template-editor-save" disabled={!canSave || saving} onClick={save}>
              {saving ? "Saving…" : profile ? "Save changes" : "Create template"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function ColumnPicker({
  label,
  value,
  headers,
  required,
  onChange,
}: {
  label: string;
  value: string;
  headers: string[];
  required?: boolean;
  onChange: (value: string) => void;
}) {
  // Without a sample there are no headers to choose from, so allow typing the header text.
  if (!headers.length) {
    return (
      <label>
        {label}
        {required && " *"}
        <input value={value} placeholder="Header text" onChange={(event) => onChange(event.target.value)} />
      </label>
    );
  }
  const options = value && !headers.includes(value) ? [value, ...headers] : headers;
  return (
    <label>
      {label}
      {required && " *"}
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{required ? "Choose a column" : "Not mapped"}</option>
        {options.map((header) => (
          <option key={header} value={header}>
            {header}
            {!headers.includes(header) ? " (not in sample)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function TemplateTestSummary({ result, boreholeCode }: { result: TemplateTestResult; boreholeCode: string }) {
  const summary = result.profile.summary;
  const counts = Object.entries(summary.borehole_row_counts ?? {});
  return (
    <div className="template-test-result">
      <p>
        <b>{summary.lithology_interval_count}</b> intervals
        {boreholeCode ? ` for ${boreholeCode}` : ""} · {summary.seam_interval_count} seams
        {summary.min_depth !== null && summary.max_depth !== null ? ` · ${summary.min_depth}–${summary.max_depth} m` : ""}
        {summary.dictionary_review_count ? ` · ${summary.dictionary_review_count} rock names need review` : ""}
      </p>
      {counts.length > 0 && (
        <p className="template-editor-hint">
          Rows per borehole in file: {counts.map(([code, count]) => `${code} ${count}`).join(" · ")}
        </p>
      )}
      {result.profile.warnings.map((warning) => (
        <p key={warning} className="template-test-warning">
          {warning}
        </p>
      ))}
      {result.profile.sample_rows.length > 0 && (
        <div className="template-sample-grid">
          <table>
            <thead>
              <tr>
                <th>Row</th>
                <th>From</th>
                <th>To</th>
                <th>Lithology</th>
                <th>Code</th>
                <th>Seam</th>
              </tr>
            </thead>
            <tbody>
              {result.profile.sample_rows.slice(0, 10).map((row) => (
                <tr key={row.source_row}>
                  <th>{row.source_row}</th>
                  <td>{row.from_depth}</td>
                  <td>{row.to_depth}</td>
                  <td>{row.lithology_source}</td>
                  <td>{row.normalized_code}</td>
                  <td>{row.seam_name ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
