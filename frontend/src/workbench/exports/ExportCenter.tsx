import { useEffect, useMemo, useState } from "react";

import { exportDownloadUrl } from "../../api/client";
import type { BoreholeWorkbench, ExportJob, ExportProfile, ExportReadiness } from "../../api/types";
import { exportAuditFacts } from "./exportJobAudit";

type Props = {
  data: BoreholeWorkbench;
  readiness?: ExportReadiness;
  jobs?: ExportJob[];
  exportProfiles?: ExportProfile[];
  creating: boolean;
  approving: boolean;
  savingProfile: boolean;
  onCreate: (payload: {
    export_type: string;
    export_profile_id?: number | null;
    stage?: string | null;
    from_depth?: number | null;
    to_depth?: number | null;
    sections?: string[] | null;
  }) => void;
  onApprove: () => void;
  onSaveExportProfile: (payload: {
    profileId: number;
    name: string;
    description: string;
    mapping: Record<string, unknown>;
  }) => void;
  onOpenWorkbench: () => void;
};

const EXPORT_FORMATS = [
  { value: "corrected_lithology_xlsx", label: "Corrected Lithology Excel", target: "Review and handover" },
  { value: "corrected_lithology_csv", label: "Corrected Lithology CSV", target: "Analytics or interchange" },
  { value: "curves_las", label: "Curve LAS", target: "Geophysical workflows" },
  { value: "curves_csv", label: "Curve CSV", target: "Curve QA and analytics" },
];

const EXPORT_STEPS = ["Select scope", "Choose template", "Review readiness", "Generate", "Audit job", "Download"];

const SECTION_OPTIONS: Record<string, Array<{ key: keyof SectionState; label: string }>> = {
  corrected_lithology_xlsx: [
    { key: "lithology", label: "Lithology intervals" },
    { key: "seams", label: "Seams" },
    { key: "recovery", label: "Recovery" },
    { key: "rqd", label: "RQD" },
    { key: "remarks", label: "Remarks" },
    { key: "ai_review", label: "AI review" },
    { key: "audit", label: "Audit" },
  ],
  corrected_lithology_csv: [
    { key: "lithology", label: "Lithology intervals" },
    { key: "seams", label: "Seams" },
    { key: "recovery", label: "Recovery" },
    { key: "rqd", label: "RQD" },
    { key: "remarks", label: "Remarks" },
  ],
  curves_las: [
    { key: "curves", label: "Geophysical curves" },
  ],
  curves_csv: [
    { key: "curves", label: "Geophysical curves" },
  ],
};

type SectionState = {
  lithology: boolean;
  seams: boolean;
  recovery: boolean;
  rqd: boolean;
  remarks: boolean;
  curves: boolean;
  core_images: boolean;
  ai_review: boolean;
  audit: boolean;
};

const EXPORT_MAPPINGS: Record<string, Array<{ source: string; target: string }>> = {
  corrected_lithology_xlsx: [
    { source: "boreholes.code, metadata", target: "Workbook header" },
    { source: "lithology_intervals.from_depth/to_depth", target: "Depth interval columns" },
    { source: "lithology_intervals.lithology_code/label", target: "Lithology columns" },
    { source: "seam_intervals.name/thickness", target: "Seam columns" },
    { source: "recovery, recovery_percent, rqd", target: "Quality columns" },
    { source: "remarks, structural_features", target: "Observation columns" },
  ],
  corrected_lithology_csv: [
    { source: "lithology_intervals", target: "One row per corrected interval" },
    { source: "seam_name, rqd, recovery", target: "Delimited columns" },
    { source: "source_row, source_workbook", target: "Provenance columns" },
  ],
  curves_las: [
    { source: "curves.key/unit", target: "LAS ~CURVE section" },
    { source: "curve_samples.depth", target: "DEPT index" },
    { source: "curve_samples.value", target: "LAS ~A sample columns" },
  ],
  curves_csv: [
    { source: "curves + curve_samples", target: "depth, curve_key, value, unit rows" },
    { source: "source_type", target: "curve provenance column" },
  ],
  minex_demo: [
    { source: "borehole metadata", target: "Minex-compatible header preview" },
    { source: "corrected lithology/seams", target: "Interval import section" },
    { source: "remarks/quality fields", target: "Optional mapped attributes" },
  ],
};

export function ExportCenter({
  data,
  readiness,
  jobs,
  exportProfiles,
  creating,
  savingProfile,
  onCreate,
  onSaveExportProfile,
  onOpenWorkbench,
}: Props) {
  const [format, setFormat] = useState("corrected_lithology_xlsx");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [stage, setStage] = useState("central_corrected");
  const [fromDepth, setFromDepth] = useState("0");
  const [toDepth, setToDepth] = useState(String(data.total_depth));
  const [sections, setSections] = useState<SectionState>({
    lithology: true,
    seams: true,
    recovery: true,
    rqd: true,
    remarks: true,
    curves: true,
    core_images: false,
    ai_review: true,
    audit: false,
  });
  const selectedFormat = EXPORT_FORMATS.find((item) => item.value === format) ?? EXPORT_FORMATS[0];
  const exportType = format;
  const matchingProfiles = exportProfiles?.filter((profile) => profile.export_type === format) ?? [];
  const selectedProfile =
    matchingProfiles.find((profile) => profile.id === selectedProfileId) ?? matchingProfiles[0] ?? null;
  const mappingRows = mappingRowsFromProfile(selectedProfile) ?? EXPORT_MAPPINGS[exportType] ?? [];
  const sectionOptions = SECTION_OPTIONS[format] ?? SECTION_OPTIONS.corrected_lithology_xlsx;
  const includedSections = useMemo(
    () => sectionOptions.filter((item) => sections[item.key]).map((item) => item.key),
    [sectionOptions, sections],
  );
  const hasBlockingReadinessIssue = readiness?.checks.some((check) => check.status === "fail") ?? false;
  const readinessTone = readiness?.ready ? "ready" : hasBlockingReadinessIssue ? "blocked" : "warning";
  const toggleSection = (key: keyof typeof sections) =>
    setSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <section className="workflow-center export-center">
      <div className="workflow-center-header">
        <div>
          <span>Export Center</span>
          <h1>{data.code} corrected log delivery</h1>
        </div>
        <button type="button" onClick={onOpenWorkbench}>
          Open workbench
        </button>
      </div>

      <div className="workflow-flow">
        {EXPORT_STEPS.map((step, index) => (
          <div key={step} className="workflow-flow-step">
            <b>{index + 1}</b>
            <span>{step}</span>
          </div>
        ))}
      </div>

      <div className="workflow-center-grid export-grid">
        <div className="workflow-column export-main-column">
          <section className="workflow-panel primary">
            <div className="workflow-panel-header">
              <strong>Export Settings</strong>
              <span>{selectedFormat.target}</span>
            </div>
            <div className="export-settings large">
              <label>
                Format
                <select value={format} onChange={(event) => setFormat(event.target.value)}>
                  {EXPORT_FORMATS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Export template
                <select
                  value={selectedProfile?.id ?? ""}
                  onChange={(event) => setSelectedProfileId(Number(event.target.value))}
                >
                  {matchingProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Correction stage
                <select value={stage} onChange={(event) => setStage(event.target.value)}>
                  <option value="raw">Raw source</option>
                  <option value="field_submitted">Field submitted</option>
                  <option value="central_corrected">Central corrected draft</option>
                  <option value="approved_final">Approved final</option>
                </select>
              </label>
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
              <div className="export-section-grid">
                {sectionOptions.map((item) => (
                  <label key={item.key}>
                    <input
                      type="checkbox"
                      checked={sections[item.key]}
                      onChange={() => toggleSection(item.key)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              <div className="export-preview-card">
                <strong>Configured package</strong>
                <span>
                  {selectedFormat.label} · {stage.replaceAll("_", " ")} · {fromDepth || 0}-
                  {toDepth || data.total_depth}m
                </span>
                <small>{includedSections.join(", ")}</small>
              </div>
            </div>
          </section>
        </div>

        <div className="workflow-column export-side-column">
          <section className="workflow-panel">
            <div className="workflow-panel-header">
              <strong>Readiness</strong>
              <span>{readiness?.ready ? "Ready" : hasBlockingReadinessIssue ? "Blocked" : "Quality warnings"}</span>
            </div>
            <div className={`export-status ${readinessTone}`}>
              <strong>
                {readiness?.ready
                  ? "Ready for export"
                  : hasBlockingReadinessIssue
                    ? "Resolve validation errors"
                    : "Export allowed with review"}
              </strong>
              <span>{readiness?.status ?? "checking"}</span>
            </div>
            <div className="export-actions">
              <button
                type="button"
                disabled={creating}
                onClick={() =>
                  onCreate({
                    export_type: exportType,
                    export_profile_id: selectedProfile?.id ?? null,
                    stage,
                    from_depth: optionalNumber(fromDepth),
                    to_depth: optionalNumber(toDepth),
                    sections: includedSections,
                  })
                }
              >
                {creating ? "Generating..." : "Generate export"}
              </button>
            </div>
          </section>

          <section className="workflow-panel export-field-mapping-panel">
            <div className="workflow-panel-header">
              <strong>Export Field Mapping</strong>
              <button
                type="button"
                disabled={!selectedProfile}
                onClick={() => setMappingDialogOpen(true)}
              >
                Edit Template
              </button>
            </div>
            <div className="export-mapping-grid compact">
              {mappingRows.map((row) => (
                <article key={`${row.source}:${row.target}`}>
                  <strong>{row.source}</strong>
                  <span>{row.target}</span>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="workflow-panel wide">
          <div className="workflow-panel-header">
            <strong>Readiness Checks</strong>
            <span>{readiness?.checks.length ?? 0} checks</span>
          </div>
          <div className="export-checks page-checks">
            {readiness?.checks.map((check) => (
              <div key={check.key} className={`export-check ${check.status}`}>
                <strong>{check.label}</strong>
                <span>{check.detail}</span>
              </div>
            ))}
            {!readiness?.checks.length && <div className="empty">No readiness checks available.</div>}
          </div>
        </section>

        <section className="workflow-panel wide">
          <div className="workflow-panel-header">
            <strong>Export History</strong>
            <span>{jobs?.length ?? 0} jobs</span>
          </div>
          <div className="workflow-table">
            {jobs?.map((job) => (
              <article key={job.id} className="workflow-row">
                <div>
                  <strong>{job.export_type.replaceAll("_", " ")}</strong>
                  <span>{job.file_name}</span>
                  <div className="export-audit-facts">
                    {exportAuditFacts(job).map((fact) => (
                      <small key={`${job.id}:${fact.label}`}>
                        <b>{fact.label}</b> {fact.value}
                      </small>
                    ))}
                  </div>
                </div>
                <small>{job.status}</small>
                <div className="workflow-row-actions">
                  <a className="download-link" href={exportDownloadUrl(job.id)}>
                    Download
                  </a>
                </div>
              </article>
            ))}
            {!jobs?.length && <div className="empty">No exports generated yet.</div>}
          </div>
        </section>
      </div>
      {mappingDialogOpen && selectedProfile && (
        <ExportProfileDialog
          profile={selectedProfile}
          curves={data.curves}
          saving={savingProfile}
          onClose={() => setMappingDialogOpen(false)}
          onSave={onSaveExportProfile}
        />
      )}
    </section>
  );
}

function mappingRowsFromProfile(profile: ExportProfile | null) {
  if (!profile) return null;
  const columns = profile.mapping.columns;
  if (Array.isArray(columns)) {
    return columns.map((item) => {
      if (typeof item === "string") return { source: item, target: item };
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        return { source: String(row.source ?? row.key ?? ""), target: String(row.target ?? row.label ?? "") };
      }
      return { source: String(item), target: String(item) };
    });
  }
  return Object.entries(profile.mapping).map(([source, target]) => ({
    source,
    target: typeof target === "string" ? target : JSON.stringify(target),
  }));
}

function optionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function ExportProfileDialog({
  profile,
  curves,
  saving,
  onClose,
  onSave,
}: {
  profile: ExportProfile;
  curves: BoreholeWorkbench["curves"];
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
  const isCurveTemplate = profile.export_type === "curves_las" || profile.export_type === "curves_csv";

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
  const formatMapping = () => {
    try {
      setMappingText(JSON.stringify(JSON.parse(mappingText), null, 2));
      setError(null);
    } catch {
      setError("Mapping JSON is not valid.");
    }
  };

  const selectedCurves = selectedCurveKeys(mappingText);
  const setCurveKeys = (curveKeys: string[]) => {
    setMappingText(JSON.stringify({ ...safeMapping(mappingText), curves: curveKeys }, null, 2));
  };
  const toggleCurve = (curveKey: string) => {
    const nextKeys = selectedCurves.includes(curveKey)
      ? selectedCurves.filter((key: string) => key !== curveKey)
      : [...selectedCurves, curveKey];
    setCurveKeys(nextKeys);
  };

  return (
    <div className="mapping-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="mapping-dialog">
        <header>
          <div>
            <strong>{profile.name}</strong>
            <span>{profile.export_type.replaceAll("_", " ")}</span>
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
              <textarea value={mappingText} spellCheck={false} onChange={(event) => setMappingText(event.target.value)} />
            </label>
            {isCurveTemplate && (
              <div className="curve-template-selector">
                <div>
                  <strong>Curves in selected borehole</strong>
                  <span>Select none to export all curves.</span>
                </div>
                <div className="curve-template-actions">
                  <button type="button" onClick={() => setCurveKeys(curves.map((curve) => curve.key))}>
                    Use all curves
                  </button>
                  <button type="button" onClick={() => setCurveKeys([])}>
                    Clear selection
                  </button>
                </div>
                <div className="curve-template-grid">
                  {curves.map((curve) => (
                    <label key={curve.key}>
                      <input
                        type="checkbox"
                        checked={selectedCurves.includes(curve.key)}
                        onChange={() => toggleCurve(curve.key)}
                      />
                      <i style={{ background: curve.color }} />
                      <span>{curve.label}</span>
                      <code>{curve.key}</code>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {error && <span className="mapping-error">{error}</span>}
            <div className="mapping-dialog-actions">
              <button type="button" onClick={formatMapping}>
                Format JSON
              </button>
              <button type="button" onClick={() => setMappingText(JSON.stringify(profile.mapping, null, 2))}>
                Restore saved mapping
              </button>
              <button type="button" onClick={save} disabled={saving || !name.trim()}>
                {saving ? "Saving..." : "Save template"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function selectedCurveKeys(mappingText: string) {
  const mapping = safeMapping(mappingText);
  return Array.isArray(mapping.curves) ? mapping.curves.map(String) : [];
}

function safeMapping(mappingText: string): Record<string, unknown> {
  try {
    return JSON.parse(mappingText) as Record<string, unknown>;
  } catch {
    return {};
  }
}
