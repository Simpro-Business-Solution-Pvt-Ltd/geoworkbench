import { useMemo, useState } from "react";

import { exportDownloadUrl } from "../../api/client";
import type { BoreholeWorkbench, ExportJob, ExportReadiness } from "../../api/types";

type Props = {
  data: BoreholeWorkbench;
  readiness: ExportReadiness | undefined;
  jobs: ExportJob[] | undefined;
  creating: boolean;
  approving: boolean;
  onCreate: (exportType: string) => void;
  onApprove: () => void;
};

const EXPORT_FORMATS = [
  { value: "corrected_lithology_xlsx", label: "Corrected Lithology Excel" },
  { value: "corrected_lithology_csv", label: "Corrected Lithology CSV" },
  { value: "curves_las", label: "Curve LAS" },
  { value: "curves_csv", label: "Curve CSV" },
  { value: "minex_demo", label: "Minex-compatible Excel" },
];

export function ExportPanel({ data, readiness, jobs, creating, onCreate }: Props) {
  const [format, setFormat] = useState("corrected_lithology_xlsx");
  const [stage, setStage] = useState("central_corrected");
  const [fromDepth, setFromDepth] = useState("0");
  const [toDepth, setToDepth] = useState(String(data.total_depth));
  const [sections, setSections] = useState({
    lithology: true,
    seams: true,
    recovery: true,
    rqd: true,
    curves: true,
    images: false,
    audit: false,
  });
  const selectedCurveKeys = useMemo(() => data.curves.map((curve) => curve.key), [data.curves]);
  const exportType = format === "minex_demo" ? "corrected_lithology_xlsx" : format;
  const hasBlockingReadinessIssue = readiness?.checks.some((check) => check.status === "fail") ?? false;
  const readinessTone = readiness?.ready ? "ready" : hasBlockingReadinessIssue ? "blocked" : "warning";
  const toggleSection = (key: keyof typeof sections) =>
    setSections((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="export-panel">
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

      <div className="export-settings">
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
            From
            <input value={fromDepth} onChange={(event) => setFromDepth(event.target.value)} />
          </label>
          <label>
            To
            <input value={toDepth} onChange={(event) => setToDepth(event.target.value)} />
          </label>
        </div>
        <div className="export-section-grid">
          {(Object.keys(sections) as Array<keyof typeof sections>).map((key) => (
            <label key={key}>
              <input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} />
              {key.toUpperCase()}
            </label>
          ))}
        </div>
        <small>
          Preview: {stage.replaceAll("_", " ")} · {fromDepth || 0}-{toDepth || data.total_depth}m ·{" "}
          {selectedCurveKeys.length} curve(s)
        </small>
      </div>

      <div className="export-checks">
        {readiness?.checks.map((check) => (
          <div key={check.key} className={`export-check ${check.status}`}>
            <strong>{check.label}</strong>
            <span>{check.detail}</span>
          </div>
        ))}
      </div>

      <div className="export-actions">
        <button
          type="button"
          disabled={creating}
          onClick={() => onCreate(exportType)}
        >
          {creating ? "Generating..." : "Generate configured export"}
        </button>
      </div>

      <div className="arrival-list">
        {jobs?.map((job) => (
          <div key={job.id} className="arrival-item">
            <strong>{job.export_type.replaceAll("_", " ")}</strong>
            <span>{job.status}</span>
            <small>{job.file_name}</small>
            <a className="download-link" href={exportDownloadUrl(job.id)}>
              Download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
