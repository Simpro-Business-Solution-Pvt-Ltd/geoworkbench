import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { createCorrelationObservation, getWorkbench, listCorrelationObservations } from "../../api/client";
import type { BoreholeListItem, BoreholeWorkbench, CorrelationObservation, Curve, LithologyInterval } from "../../api/types";
import { lithologyPattern } from "../core/lithologyPatterns";
import { metadataFor, rlLabel, type BoreholeMeta } from "./correlationMetadata";

type Props = {
  boreholes: BoreholeListItem[];
  initialIds: number[];
  onOpenWorkbench: (id: number) => void;
};

type AlignMode = "depth" | "rl";
type CorrelationDatasetMode = "synthetic" | "received" | "custom";

type CorrelationInsight = {
  id: string;
  severity: "review" | "watch" | "good";
  title: string;
  detail: string;
  evidence: string;
};

type SeamCorrelationRow = {
  seamName: string;
  presentCount: number;
  missingCount: number;
  minTop: number;
  maxTop: number;
  minThickness: number;
  maxThickness: number;
  items: Array<{ borehole: string; top: number; bottom: number; thickness: number }>;
};

type CollarContextRow = {
  borehole: string;
  x: number | null;
  y: number | null;
  rlLabel: string;
  rlSource: BoreholeMeta["rlSource"];
  waterLevel: number | null;
  distanceFromReference: number | null;
  seamCount: number;
  curveCount: number;
};

export function CorrelationWorkspace({ boreholes, initialIds, onOpenWorkbench }: Props) {
  const syntheticIds = useMemo(
    () => boreholes.filter((item) => item.project_code === "DEMO-COAL-BLOCK").slice(0, 5).map((item) => item.id),
    [boreholes],
  );
  const receivedIds = useMemo(
    () => boreholes.filter((item) => item.project_code !== "DEMO-COAL-BLOCK").slice(0, 6).map((item) => item.id),
    [boreholes],
  );
  const defaultIds = syntheticIds.length ? syntheticIds : initialIds;
  const [datasetMode, setDatasetMode] = useState<CorrelationDatasetMode>(syntheticIds.length ? "synthetic" : "received");
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultIds);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [alignMode, setAlignMode] = useState<AlignMode>("depth");
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [reviewedInsightIds, setReviewedInsightIds] = useState<Set<string>>(() => new Set());
  const queryClient = useQueryClient();
  const queries = useQueries({
    queries: selectedIds.map((id) => ({
      queryKey: ["workbench", id],
      queryFn: () => getWorkbench(id),
      enabled: selectedIds.length > 0,
    })),
  });
  const loaded = queries
    .map((query) => query.data)
    .filter((item): item is BoreholeWorkbench => Boolean(item));
  const domain = useMemo(() => correlationDomain(loaded, alignMode), [loaded, alignMode]);
  const seamRows = useMemo(() => seamCorrelationRows(loaded), [loaded]);
  const collarRows = useMemo(() => collarContextRows(loaded), [loaded]);
  const insights = useMemo(() => buildCorrelationInsights(loaded, seamRows), [loaded, seamRows]);
  const stats = useMemo(
    () => correlationStats(loaded, seamRows, collarRows, domain, alignMode),
    [alignMode, collarRows, domain, loaded, seamRows],
  );
  const correlationKey = useMemo(() => selectedIds.slice().sort((a, b) => a - b).join(":"), [selectedIds]);
  const observationsQuery = useQuery({
    queryKey: ["correlation-observations", correlationKey],
    queryFn: () => listCorrelationObservations(selectedIds),
    enabled: selectedIds.length > 0,
  });
  const saveObservation = useMutation({
    mutationFn: (text: string) =>
      createCorrelationObservation({
        borehole_ids: selectedIds,
        text,
        observation_metadata: { source: "correlation_dialog", align_mode: alignMode },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["correlation-observations", correlationKey] });
    },
  });

  useEffect(() => {
    if (selectedIds.length || !boreholes.length) return;
    if (datasetMode === "synthetic" && syntheticIds.length) setSelectedIds(syntheticIds);
    else if (datasetMode === "received" && receivedIds.length) setSelectedIds(receivedIds);
    else if (initialIds.length) setSelectedIds(initialIds);
  }, [boreholes.length, datasetMode, initialIds, receivedIds, selectedIds.length, syntheticIds]);

  const toggleBorehole = (id: number) => {
    setDatasetMode("custom");
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-7),
    );
  };
  const applyPreset = (mode: CorrelationDatasetMode) => {
    setDatasetMode(mode);
    if (mode === "synthetic") setSelectedIds(syntheticIds.length ? syntheticIds : initialIds);
    if (mode === "received") setSelectedIds(receivedIds.length ? receivedIds : initialIds);
    if (mode !== "custom") setSelectorOpen(false);
  };
  const selectedBoreholes = boreholes.filter((item) => selectedIds.includes(item.id));

  return (
    <section className="correlation-workspace">
      <div className="correlation-toolbar">
        <div>
          <h1>Correlation Display</h1>
          <p>Compare selected boreholes by lithology, seam markers, and normalized Natural Gamma response.</p>
        </div>
        <div className="correlation-toolbar-actions">
          <button type="button" onClick={() => setInsightsOpen(true)}>
            AI insights
          </button>
          <div className="segmented-control">
            <button
              type="button"
              className={alignMode === "depth" ? "active" : ""}
              onClick={() => setAlignMode("depth")}
            >
              Depth
            </button>
            <button
              type="button"
              className={alignMode === "rl" ? "active" : ""}
              onClick={() => setAlignMode("rl")}
            >
              RL
            </button>
          </div>
        </div>
      </div>

      <div className="correlation-help-strip">
        <span>
          <b>Depth</b> aligns each borehole from collar depth 0m.
        </span>
        <span>
          <b>RL</b> aligns by elevation datum: collar RL minus downhole depth.
        </span>
        <span>
          <i className="gamma-swatch" /> Red curve is normalized Natural Gamma for visual comparison.
        </span>
        <span>
          <b>Evidence</b> {stats.boreholes} boreholes · {stats.commonSeams} common seam groups · {stats.gammaCoverage}
        </span>
        <span>
          <b>Range</b> {stats.rangeLabel}
        </span>
        <span>
          <b>Spatial</b> {stats.spatialLabel}
        </span>
        <span className={stats.rlDefaulted ? "correlation-warning-text" : ""}>
          <b>RL</b> {stats.rlLabel}
        </span>
      </div>

      <div className="correlation-selector compact">
        <div className="correlation-preset-controls">
          <button
            type="button"
            className={datasetMode === "synthetic" ? "active" : ""}
            disabled={!syntheticIds.length}
            onClick={() => applyPreset("synthetic")}
          >
            Synthetic Coal Block
          </button>
          <button
            type="button"
            className={datasetMode === "received" ? "active" : ""}
            disabled={!receivedIds.length}
            onClick={() => applyPreset("received")}
          >
            Received Data Comparison
          </button>
          <button
            type="button"
            className={datasetMode === "custom" ? "active" : ""}
            onClick={() => {
              setDatasetMode("custom");
              setSelectorOpen((open) => !open);
            }}
          >
            Choose Boreholes
          </button>
        </div>
        <div className="selected-correlation-summary">
          <strong>{selectedIds.length} selected</strong>
          <span>{selectedBoreholes.map((item) => item.code).join(", ") || "No boreholes selected"}</span>
        </div>
        {selectorOpen && (
          <div className="correlation-picker-list">
            {boreholes.map((item) => (
              <label key={item.id} className={selectedIds.includes(item.id) ? "selected" : ""}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleBorehole(item.id)}
                />
                <span>{item.project_code} / {item.site_code} / {item.code}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="correlation-panel">
        <div className="correlation-axis">
          <div className="correlation-axis-header">Depth</div>
          <div className="correlation-axis-body">
            {axisTicks(domain.min, domain.max).map((tick) => (
            <span key={tick} style={{ top: `${axisTickPercent(tick, domain)}%` }}>
                {tick.toFixed(0)}
                {alignMode === "rl" ? " RL" : "m"}
              </span>
            ))}
          </div>
        </div>
        <div className="correlation-columns">
          {loaded.map((data) => (
            <CorrelationColumn
              key={data.id}
              data={data}
              domain={domain}
              alignMode={alignMode}
              onOpenWorkbench={onOpenWorkbench}
            />
          ))}
          {!loaded.length && <div className="empty">Select boreholes to build a correlation display.</div>}
        </div>
      </div>
      {insightsOpen && (
        <CorrelationInsightsDialog
          insights={insights}
          seamRows={seamRows}
          collarRows={collarRows}
          boreholeCount={loaded.length}
          reviewedInsightIds={reviewedInsightIds}
          savedNotes={observationsQuery.data ?? []}
          notesLoading={observationsQuery.isLoading}
          savePending={saveObservation.isPending}
          onClose={() => setInsightsOpen(false)}
          onMarkReviewed={(insightId) =>
            setReviewedInsightIds((current) => {
              const next = new Set(current);
              next.add(insightId);
              return next;
            })
          }
          onSaveNote={(text) => saveObservation.mutate(text)}
        />
      )}
    </section>
  );
}

function CorrelationInsightsDialog({
  insights,
  seamRows,
  collarRows,
  boreholeCount,
  reviewedInsightIds,
  savedNotes,
  notesLoading,
  savePending,
  onClose,
  onMarkReviewed,
  onSaveNote,
}: {
  insights: CorrelationInsight[];
  seamRows: SeamCorrelationRow[];
  collarRows: CollarContextRow[];
  boreholeCount: number;
  reviewedInsightIds: Set<string>;
  savedNotes: CorrelationObservation[];
  notesLoading: boolean;
  savePending: boolean;
  onClose: () => void;
  onMarkReviewed: (insightId: string) => void;
  onSaveNote: (text: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="correlation-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="correlation-dialog">
        <header>
          <div>
            <strong>AI Correlation Insights</strong>
            <span>Rule generated · ready for local model narrative</span>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="correlation-dialog-grid">
          <section className="correlation-insights">
            <div className="correlation-section-title">
              <strong>Review Queue</strong>
              <span>{reviewedInsightIds.size}/{insights.length} reviewed</span>
            </div>
            <div className="correlation-insight-list modal-list">
              {insights.map((insight) => (
                <article key={insight.id} className={`correlation-insight ${insight.severity}`}>
                  <strong>{insight.title}</strong>
                  <p>{insight.detail}</p>
                  <small>{insight.evidence}</small>
                  <div className="correlation-insight-actions">
                    <button
                      type="button"
                      disabled={reviewedInsightIds.has(insight.id)}
                      onClick={() => onMarkReviewed(insight.id)}
                    >
                      {reviewedInsightIds.has(insight.id) ? "Reviewed" : "Mark reviewed"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNote(
                          `${insight.title}: ${insight.detail} Evidence: ${insight.evidence}`,
                        )
                      }
                    >
                      Draft note
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="correlation-context-stack">
            <div className="correlation-collar-table">
              <div className="correlation-section-title">
                <strong>Collar And Spatial Context</strong>
                <span>{collarRows.length} boreholes</span>
              </div>
              <div className="collar-table">
                <span>Borehole</span>
                <span>Coordinates</span>
                <span>Distance</span>
                <span>Evidence</span>
                <span>RL / WL</span>
                {collarRows.map((row) => (
                  <Fragment key={row.borehole}>
                    <b>{row.borehole}</b>
                    <span>{formatCoordinatePair(row)}</span>
                    <span>{formatDistance(row.distanceFromReference)}</span>
                    <span>{row.seamCount} seams · {row.curveCount} curves</span>
                    <span>{row.rlLabel}{row.waterLevel !== null ? ` / WL ${row.waterLevel.toFixed(1)}m` : ""}</span>
                  </Fragment>
                ))}
                {!collarRows.length && <span className="empty-row">No boreholes selected.</span>}
              </div>
            </div>
            <section className="correlation-seam-table">
            <div className="correlation-section-title">
              <strong>Seam Continuity</strong>
              <span>{seamRows.length} seam groups</span>
            </div>
            <div className="seam-table">
              <span>Seam</span>
              <span>Present</span>
              <span>Top range</span>
              <span>Thickness</span>
              {seamRows.slice(0, 8).map((row) => (
                <Fragment key={row.seamName}>
                  <b>{row.seamName}</b>
                  <span>
                    {row.presentCount}/{boreholeCount}
                    {row.missingCount ? " missing" : ""}
                  </span>
                  <span>
                    {row.minTop.toFixed(1)}-{row.maxTop.toFixed(1)}m
                  </span>
                  <span>
                    {row.minThickness.toFixed(2)}-{row.maxThickness.toFixed(2)}m
                  </span>
                </Fragment>
              ))}
              {!seamRows.length && <span className="empty-row">No seam markers found in selected boreholes.</span>}
            </div>
            <form
              className="correlation-note-form"
              onSubmit={(event) => {
                event.preventDefault();
                const trimmed = note.trim();
                if (!trimmed) return;
                onSaveNote(trimmed);
                setNote("");
              }}
            >
              <label>
                Geologist interpretation note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Record seam correlation decision, uncertainty, or follow-up action."
                />
              </label>
              <button type="submit" disabled={savePending}>{savePending ? "Saving..." : "Save note"}</button>
            </form>
            <div className="saved-correlation-notes">
              {savedNotes.map((item) => (
                <article key={item.id}>
                  <strong>{item.created_by} · {new Date(item.created_at).toLocaleString()}</strong>
                  <span>{item.text}</span>
                </article>
              ))}
              {notesLoading && <small>Loading saved correlation notes...</small>}
              {!notesLoading && !savedNotes.length && <small>No saved correlation notes for this borehole set.</small>}
            </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}

function CorrelationColumn({
  data,
  domain,
  alignMode,
  onOpenWorkbench,
}: {
  data: BoreholeWorkbench;
  domain: { min: number; max: number };
  alignMode: AlignMode;
  onOpenWorkbench: (id: number) => void;
}) {
  const meta = metadataFor(data);
  const gamma = data.curves.find((curve) => curve.key === "ngam" || curve.key === "gamma");
  const gammaPath = gamma ? curvePath(gamma, data, domain, alignMode, meta) : "";
  const seamThickness = data.seam_intervals.reduce((sum, seam) => sum + Math.max(0, seam.to_depth - seam.from_depth), 0);
  return (
    <article className="correlation-column">
      <header>
        <strong>{data.code}</strong>
        <span>
          {rlLabel(meta)} · {data.seam_intervals.length} seams · {seamThickness.toFixed(1)}m coal
        </span>
        <small>0-{data.total_depth.toFixed(0)}m TD</small>
        <button type="button" onClick={() => onOpenWorkbench(data.id)}>
          Open
        </button>
      </header>
      <div className="correlation-log">
        <div className="correlation-lithology">
          {data.lithology_intervals.map((interval) => {
            const pattern = lithologyPattern(interval.lithology_code);
            return (
              <div
                key={interval.id}
                className={`correlation-lith lithology-pattern ${pattern.className}`}
                style={{
                  top: `${intervalTop(interval, data, domain, alignMode, meta)}%`,
                  height: `${intervalHeight(interval, data, domain, alignMode, meta)}%`,
                  backgroundColor: interval.display_color ?? pattern.color,
                }}
                title={`${interval.from_depth}-${interval.to_depth}m ${interval.lithology_label}`}
              />
            );
          })}
        </div>
        <svg className="correlation-curve" viewBox="0 0 100 100" preserveAspectRatio="none">
          {gammaPath && <path d={gammaPath} fill="none" stroke="#ef4444" strokeWidth="1.4" />}
        </svg>
        <div className="correlation-curve-label">
          <i />
          Gamma
        </div>
        <div className="correlation-markers">
          {data.seam_intervals.map((seam) => {
            const y = depthY((seam.from_depth + seam.to_depth) / 2, data, domain, alignMode, meta);
            return (
              <span key={seam.id} style={{ top: `${y}%` }}>
                <b>{seam.name}</b>
              </span>
            );
          })}
          {meta.waterLevel !== null && (
            <span className="water-marker" style={{ top: `${depthY(meta.waterLevel, data, domain, alignMode, meta)}%` }}>
              <b>WL</b>
            </span>
          )}
        </div>
        <span className="correlation-depth-bottom">{data.total_depth.toFixed(0)}m TD</span>
      </div>
    </article>
  );
}

function seamCorrelationRows(items: BoreholeWorkbench[]): SeamCorrelationRow[] {
  const groups = new Map<string, SeamCorrelationRow["items"]>();
  for (const data of items) {
    for (const seam of data.seam_intervals) {
      const name = (seam.name || "Unnamed seam").trim().toUpperCase();
      const current = groups.get(name) ?? [];
      current.push({
        borehole: data.code,
        top: seam.from_depth,
        bottom: seam.to_depth,
        thickness: Math.max(0, seam.to_depth - seam.from_depth),
      });
      groups.set(name, current);
    }
  }

  return Array.from(groups.entries())
    .map(([seamName, groupItems]) => {
      const tops = groupItems.map((item) => item.top);
      const thicknesses = groupItems.map((item) => item.thickness);
      return {
        seamName,
        presentCount: groupItems.length,
        missingCount: Math.max(0, items.length - groupItems.length),
        minTop: Math.min(...tops),
        maxTop: Math.max(...tops),
        minThickness: Math.min(...thicknesses),
        maxThickness: Math.max(...thicknesses),
        items: groupItems,
      };
    })
    .sort((a, b) => b.presentCount - a.presentCount || a.minTop - b.minTop);
}

function collarContextRows(items: BoreholeWorkbench[]): CollarContextRow[] {
  const reference = items.map((item) => metadataFor(item)).find((meta) => meta.x !== null && meta.y !== null) ?? null;
  return items.map((item) => {
    const meta = metadataFor(item);
    const distanceFromReference =
      reference && meta.x !== null && meta.y !== null
        ? Math.hypot(meta.x - reference.x!, meta.y - reference.y!)
        : null;
    return {
      borehole: item.code,
      x: meta.x,
      y: meta.y,
      rlLabel: rlLabel(meta),
      rlSource: meta.rlSource,
      waterLevel: meta.waterLevel,
      distanceFromReference,
      seamCount: item.seam_intervals.length,
      curveCount: item.curves.length,
    };
  });
}

function buildCorrelationInsights(items: BoreholeWorkbench[], seamRows: SeamCorrelationRow[]): CorrelationInsight[] {
  if (!items.length) {
    return [
      {
        id: "empty",
        severity: "watch",
        title: "Select boreholes for correlation",
        detail: "Choose nearby boreholes to compare seam continuity, lithology packages, and curve response.",
        evidence: "No boreholes selected.",
      },
    ];
  }

  const insights: CorrelationInsight[] = [];
  const selectedCodes = items.map((item) => item.code).join(", ");
  const commonSeams = seamRows.filter((row) => row.presentCount >= Math.max(2, Math.ceil(items.length * 0.6)));
  const missingSeams = seamRows.filter((row) => row.missingCount > 0 && row.presentCount >= 2);
  const variableSeams = seamRows.filter((row) => row.maxThickness - row.minThickness >= 1);
  const curveCoverage = items.map((item) => ({
    code: item.code,
    curves: item.curves.length,
    hasGamma: item.curves.some((curve) => ["ngam", "gamma"].includes(curve.key)),
  }));
  const curveGaps = curveCoverage.filter((item) => !item.hasGamma || item.curves < 2);
  const defaultRl = items.filter((item) => metadataFor(item).rlSource === "default");
  const missingCoordinates = items.filter((item) => {
    const meta = metadataFor(item);
    return meta.x === null || meta.y === null;
  });

  insights.push({
    id: "selected",
    severity: commonSeams.length ? "good" : "watch",
    title: `${items.length} boreholes compared`,
    detail:
      commonSeams.length > 0
        ? `${commonSeams.length} seam group(s) appear continuous enough for geologist review.`
        : "No dominant common seam group is visible across the selected boreholes.",
    evidence: selectedCodes,
  });

  if (defaultRl.length) {
    insights.push({
      id: "rl-defaulted",
      severity: "watch",
      title: "RL datum needs confirmation",
      detail:
        "One or more selected boreholes do not expose collar reduced level in the imported metadata. RL alignment is using a placeholder datum for those boreholes.",
      evidence: defaultRl.map((item) => item.code).join(" · "),
    });
  }

  if (missingCoordinates.length) {
    insights.push({
      id: "missing-coordinates",
      severity: "review",
      title: "Spatial context is incomplete",
      detail:
        "Some selected boreholes do not expose collar coordinates. Spatial distance and nearby-borehole correlation confidence should be reviewed.",
      evidence: missingCoordinates.map((item) => item.code).join(" · "),
    });
  }

  if (missingSeams.length) {
    const seam = missingSeams[0];
    insights.push({
      id: `missing:${seam.seamName}`,
      severity: "review",
      title: `Missing marker review: ${seam.seamName}`,
      detail: `${seam.seamName} is present in ${seam.presentCount} borehole(s) but missing in ${seam.missingCount}. Check whether the seam pinches out, is unlogged, or needs relabelling.`,
      evidence: seam.items.map((item) => `${item.borehole} ${item.top.toFixed(1)}-${item.bottom.toFixed(1)}m`).join(" · "),
    });
  }

  if (variableSeams.length) {
    const seam = variableSeams[0];
    insights.push({
      id: `thickness:${seam.seamName}`,
      severity: "watch",
      title: `Thickness variation: ${seam.seamName}`,
      detail: `Thickness changes from ${seam.minThickness.toFixed(2)}m to ${seam.maxThickness.toFixed(2)}m. Confirm whether this is expected seam geometry or a logging/correlation issue.`,
      evidence: seam.items.map((item) => `${item.borehole}: ${item.thickness.toFixed(2)}m`).join(" · "),
    });
  }

  if (curveGaps.length) {
    insights.push({
      id: "curve-gaps",
      severity: "review",
      title: "Curve evidence is uneven",
      detail: "Some selected boreholes have limited gamma/geophysical curve support, so seam correlation confidence should be treated as lower there.",
      evidence: curveGaps.map((item) => `${item.code}: ${item.curves} curve(s)`).join(" · "),
    });
  }

  const coalRich = items
    .map((item) => ({
      code: item.code,
      coalIntervals: item.lithology_intervals.filter((interval) =>
        `${interval.lithology_code ?? ""} ${interval.lithology_label}`.toLowerCase().includes("coal"),
      ).length,
    }))
    .sort((a, b) => b.coalIntervals - a.coalIntervals);
  if (coalRich.length >= 2 && coalRich[0].coalIntervals - coalRich.at(-1)!.coalIntervals >= 3) {
    insights.push({
      id: "coal-package-change",
      severity: "watch",
      title: "Coal package frequency changes",
      detail: "The number of coal/carbonaceous intervals varies noticeably across the selected boreholes.",
      evidence: coalRich.map((item) => `${item.code}: ${item.coalIntervals}`).join(" · "),
    });
  }

  return insights.slice(0, 5);
}

function correlationStats(
  items: BoreholeWorkbench[],
  seamRows: SeamCorrelationRow[],
  collarRows: CollarContextRow[],
  domain: { min: number; max: number },
  alignMode: AlignMode,
) {
  const gammaCount = items.filter((item) => item.curves.some((curve) => ["ngam", "gamma"].includes(curve.key))).length;
  const commonSeams = seamRows.filter((row) => row.presentCount >= Math.max(2, Math.ceil(items.length * 0.6))).length;
  const distances = collarRows
    .map((row) => row.distanceFromReference)
    .filter((value): value is number => value !== null && value > 0);
  const coordinateCount = collarRows.filter((row) => row.x !== null && row.y !== null).length;
  const defaultRlCount = collarRows.filter((row) => row.rlSource === "default").length;
  return {
    boreholes: items.length,
    commonSeams,
    gammaCoverage: items.length ? `${gammaCount}/${items.length} with gamma` : "no curve evidence",
    rangeLabel:
      alignMode === "rl"
        ? `${domain.min.toFixed(0)}-${domain.max.toFixed(0)} RL`
        : `${domain.min.toFixed(0)}-${domain.max.toFixed(0)} m`,
    spatialLabel: !items.length
      ? "not evaluated"
      : coordinateCount < items.length
        ? `${coordinateCount}/${items.length} with coordinates`
        : distances.length
          ? `within ${formatDistance(Math.max(...distances))}`
          : "reference borehole",
    rlLabel: defaultRlCount
      ? `${defaultRlCount}/${items.length} estimated`
      : items.length
        ? "from supplied metadata"
        : "not evaluated",
    rlDefaulted: defaultRlCount > 0,
  };
}

function formatCoordinatePair(row: CollarContextRow): string {
  if (row.x === null || row.y === null) return "-";
  return `${row.x.toFixed(1)}, ${row.y.toFixed(1)}`;
}

function formatDistance(value: number | null): string {
  if (value === null) return "-";
  if (value < 1) return "reference";
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${value.toFixed(0)} m`;
}

function correlationDomain(items: BoreholeWorkbench[], alignMode: AlignMode): { min: number; max: number } {
  if (!items.length) return { min: 0, max: 500 };
  if (alignMode === "depth") {
    return { min: 0, max: Math.max(...items.map((item) => item.total_depth)) };
  }
  const values = items.flatMap((item) => {
    const meta = metadataFor(item);
    return [meta.rl - item.total_depth, meta.rl];
  });
  return { min: Math.floor(Math.min(...values) / 25) * 25, max: Math.ceil(Math.max(...values) / 25) * 25 };
}

function axisTicks(min: number, max: number): number[] {
  const span = Math.max(1, max - min);
  const step = span > 600 ? 100 : span > 280 ? 50 : 25;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max; value += step) ticks.push(value);
  return ticks;
}

function toPercent(value: number, domain: { min: number; max: number }): number {
  return ((value - domain.min) / Math.max(1, domain.max - domain.min)) * 100;
}

function axisTickPercent(value: number, domain: { min: number; max: number }): number {
  return toPercent(value, domain);
}

function depthValue(depth: number, data: BoreholeWorkbench, alignMode: AlignMode, meta: BoreholeMeta): number {
  return alignMode === "rl" ? meta.rl - depth : depth;
}

function depthY(
  depth: number,
  data: BoreholeWorkbench,
  domain: { min: number; max: number },
  alignMode: AlignMode,
  meta: BoreholeMeta,
): number {
  const value = depthValue(depth, data, alignMode, meta);
  const percent = toPercent(value, domain);
  return alignMode === "rl" ? 100 - percent : percent;
}

function intervalTop(
  interval: LithologyInterval,
  data: BoreholeWorkbench,
  domain: { min: number; max: number },
  alignMode: AlignMode,
  meta: BoreholeMeta,
): number {
  return alignMode === "rl"
    ? depthY(interval.to_depth, data, domain, alignMode, meta)
    : depthY(interval.from_depth, data, domain, alignMode, meta);
}

function intervalHeight(
  interval: LithologyInterval,
  data: BoreholeWorkbench,
  domain: { min: number; max: number },
  alignMode: AlignMode,
  meta: BoreholeMeta,
): number {
  return Math.max(
    0.3,
    Math.abs(
      depthY(interval.to_depth, data, domain, alignMode, meta) -
        depthY(interval.from_depth, data, domain, alignMode, meta),
    ),
  );
}

function curvePath(
  curve: Curve,
  data: BoreholeWorkbench,
  domain: { min: number; max: number },
  alignMode: AlignMode,
  meta: BoreholeMeta,
): string {
  if (!curve.samples.length) return "";
  const values = curve.samples.map((sample) => sample.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const every = Math.max(1, Math.floor(curve.samples.length / 160));
  return curve.samples
    .filter((_, index) => index % every === 0)
    .map((sample, index) => {
      const x = 8 + ((sample.value - min) / Math.max(0.001, max - min)) * 84;
      const y = depthY(sample.depth, data, domain, alignMode, meta);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
