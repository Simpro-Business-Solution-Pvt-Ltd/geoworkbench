import { useMemo, useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { exportDownloadUrl, listExportSourceFields } from "../../api/client";
import { queryKeys } from "../../api/queryKeys";
import type { BoreholeWorkbench, ExportJob, ExportProfile, ExportReadiness } from "../../api/types";
import { mappingRowsFromTemplate } from "../templates/templateMappingSummary";
import { TemplateEditorDialog, type ExportTemplateSavePayload } from "../imports/TemplateEditorDialog";
import { exportAuditFacts } from "./exportJobAudit";
import { curvesMappingForType, defaultExportColumns } from "./exportTemplateModel";

type ExportEditorTarget = {
  profile: ExportProfile | null;
  seedMapping?: Record<string, unknown> | null;
  seedName?: string;
};

type Props = {
  data: BoreholeWorkbench;
  readiness?: ExportReadiness;
  jobs?: ExportJob[];
  exportProfiles?: ExportProfile[];
  creating: boolean;
  approving: boolean;
  savingProfile: boolean;
  archivingProfile: boolean;
  profileError: string | null;
  onCreate: (payload: {
    export_type: string;
    export_profile_id?: number | null;
    stage?: string | null;
    from_depth?: number | null;
    to_depth?: number | null;
    sections?: string[] | null;
  }) => void;
  onApprove: () => void;
  onSaveExportProfile: (payload: ExportTemplateSavePayload, onSaved: () => void) => void;
  onArchiveExportProfile: (profileId: number, archived: boolean, mapping: Record<string, unknown>) => void;
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
  archivingProfile,
  profileError,
  onCreate,
  onSaveExportProfile,
  onArchiveExportProfile,
  onOpenWorkbench,
}: Props) {
  const [format, setFormat] = useState("corrected_lithology_xlsx");
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [exportEditorTarget, setExportEditorTarget] = useState<ExportEditorTarget | null>(null);
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
  const mappingRows = selectedProfile ? mappingRowsFromTemplate(selectedProfile.mapping) : EXPORT_MAPPINGS[exportType] ?? [];
  const sectionOptions = SECTION_OPTIONS[format] ?? SECTION_OPTIONS.corrected_lithology_xlsx;
  const includedSections = useMemo(
    () => sectionOptions.filter((item) => sections[item.key]).map((item) => item.key),
    [sectionOptions, sections],
  );
  const exportSourceFields = useQuery({
    queryKey: queryKeys.exportSourceFields,
    queryFn: listExportSourceFields,
    enabled: Boolean(exportEditorTarget),
    staleTime: 10 * 60_000,
  });
  const openNewExportEditor = () => {
    setExportEditorTarget({
      profile: null,
      seedMapping: format.startsWith("corrected_lithology")
        ? { columns: defaultExportColumns(exportSourceFields.data ?? []) }
        : { curves: curvesMappingForType(format, data.curves) },
      seedName: defaultProfileName(format),
    });
  };
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
              <div className="workflow-panel-actions">
                <button type="button" onClick={openNewExportEditor}>
                  New Template
                </button>
                <button
                  type="button"
                  disabled={!selectedProfile}
                  onClick={() => setExportEditorTarget({ profile: selectedProfile })}
                >
                  Edit Template
                </button>
              </div>
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
      {exportEditorTarget && exportSourceFields.data && (
        <TemplateEditorDialog
          key={
            exportEditorTarget.profile
              ? `profile-${exportEditorTarget.profile.id}`
              : `new-${exportEditorTarget.seedName ?? ""}`
          }
          kind="export"
          exportProfile={exportEditorTarget.profile ?? undefined}
          exportSeedMapping={exportEditorTarget.seedMapping}
          exportSeedName={exportEditorTarget.seedName}
          exportType={format}
          exportSourceFields={exportSourceFields.data}
          exportCurves={data.curves}
          canManage
          saving={savingProfile}
          archiving={archivingProfile}
          saveError={profileError}
          onClose={() => setExportEditorTarget(null)}
          onExportSave={(payload) => onSaveExportProfile(payload, () => setExportEditorTarget(null))}
          onExportArchive={onArchiveExportProfile}
          onExportDuplicate={(profile) =>
            setExportEditorTarget({
              profile: null,
              seedMapping: { ...profile.mapping, version: undefined, status: undefined },
              seedName: `${profile.name} copy`,
            })
          }
        />
      )}
    </section>
  );
}

function optionalNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultProfileName(format: string): string {
  if (format === "corrected_lithology_xlsx") return "Reliance XLSX Export";
  if (format === "corrected_lithology_csv") return "Reliance CSV Export";
  if (format === "curves_las") return "Reliance LAS Export";
  return "Reliance Curve CSV Export";
}


