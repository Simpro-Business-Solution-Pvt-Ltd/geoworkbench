import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";

import { createCorrelationObservation, getCorrelationAiSummary, getWorkbench, listCorrelationObservations } from "../../api/client";
import type { BoreholeListItem, BoreholeWorkbench, CorrelationAiSummary, CorrelationObservation, Curve, LithologyInterval } from "../../api/types";
import { lithologyPattern } from "../core/lithologyPatterns";
import { correlationDecisionPrompt, correlationInsightObservationText } from "./correlationActionModel";
import {
  buildCorrelationInsights,
  collarContextRows,
  correlationStats,
  formatCoordinatePair,
  formatDistance,
  isGammaCurve,
  seamCorrelationRows,
  type CollarContextRow,
  type CorrelationAlignMode,
  type CorrelationInsight,
  type SeamCorrelationRow,
} from "./correlationInsights";
import { metadataFor, rlLabel, type BoreholeMeta } from "./correlationMetadata";
import { buildSeamTieLines, type CorrelationTieLine } from "./correlationTieLines";

type Props = {
  boreholes: BoreholeListItem[];
  initialIds: number[];
  onOpenWorkbench: (id: number, focusDepth?: number | null) => void;
};

type AlignMode = CorrelationAlignMode;
export function CorrelationWorkspace({ boreholes, initialIds, onOpenWorkbench }: Props) {
  const receivedIds = useMemo(
    () => boreholes.filter((item) => item.project_code !== "DEMO-COAL-BLOCK").map((item) => item.id),
    [boreholes],
  );
  const defaultIds = receivedIds.length ? receivedIds : initialIds;
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultIds);
  const [referenceId, setReferenceId] = useState<number | null>(defaultIds[0] ?? null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [alignMode, setAlignMode] = useState<AlignMode>("depth");
  const [selectedSeamName, setSelectedSeamName] = useState<string>("");
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
  const collarRows = useMemo(() => collarContextRows(loaded, referenceId), [loaded, referenceId]);
  const tieLines = useMemo(() => buildSeamTieLines(loaded, domain, alignMode), [alignMode, domain, loaded]);
  const focusSeamRows = useMemo(() => seamRows.filter((row) => row.presentCount >= 2), [seamRows]);
  const selectedSeamRow = focusSeamRows.find((row) => row.seamName === selectedSeamName) ?? focusSeamRows[0] ?? null;
  const drawableTieLines = useMemo(
    () => tieLines.filter((line) => selectedSeamRow && line.seamName === selectedSeamRow.seamName),
    [selectedSeamRow, tieLines],
  );
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
  const correlationAiSummary = useQuery({
    queryKey: ["correlation-ai-summary", correlationKey, selectedSeamRow?.seamName ?? "", alignMode],
    queryFn: () =>
      getCorrelationAiSummary({
        borehole_ids: selectedIds,
        focus_seam: selectedSeamRow?.seamName ?? null,
        align_mode: alignMode,
      }),
    enabled: insightsOpen && selectedIds.length > 0,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const saveObservation = useMutation({
    mutationFn: (text: string) =>
      createCorrelationObservation({
        borehole_ids: selectedIds,
        text,
        observation_metadata: { source: "correlation_dialog", align_mode: alignMode, reference_borehole_id: referenceId },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["correlation-observations", correlationKey] });
    },
  });

  useEffect(() => {
    if (selectedIds.length || !boreholes.length) return;
    if (receivedIds.length) setSelectedIds(receivedIds);
    else if (initialIds.length) setSelectedIds(initialIds);
  }, [boreholes.length, initialIds, receivedIds, selectedIds.length]);

  useEffect(() => {
    if (!selectedIds.length) {
      setReferenceId(null);
      return;
    }
    if (referenceId === null || !selectedIds.includes(referenceId)) {
      setReferenceId(selectedIds[0]);
    }
  }, [referenceId, selectedIds]);

  useEffect(() => {
    if (!focusSeamRows.length) {
      setSelectedSeamName("");
      return;
    }
    if (!selectedSeamName || !focusSeamRows.some((row) => row.seamName === selectedSeamName)) {
      setSelectedSeamName(defaultFocusSeam(focusSeamRows).seamName);
    }
  }, [focusSeamRows, selectedSeamName]);

  const toggleBorehole = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
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
          <b>Seam links</b> {drawableTieLines.length} shown for {selectedSeamRow?.seamName ?? "selected seam"} · {tieLines.length} available
        </span>
        {selectedSeamRow && (
          <span>
            <b>Focus seam</b> {selectedSeamRow.seamName} present in {selectedSeamRow.presentCount}/{loaded.length} boreholes ·{" "}
            {selectedSeamRow.items.length} picks
          </span>
        )}
        {selectedSeamRow && (
          <span>
            <b>Top spread</b> {selectedSeamRow.minTop.toFixed(1)}-{selectedSeamRow.maxTop.toFixed(1)}m
          </span>
        )}
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
            className={selectorOpen ? "active" : ""}
            onClick={() => setSelectorOpen((open) => !open)}
          >
            Choose Boreholes
          </button>
        </div>
        <div className="correlation-focus-control">
          <span>Focus seam</span>
          <select
            value={selectedSeamRow?.seamName ?? ""}
            disabled={!focusSeamRows.length}
            onChange={(event) => setSelectedSeamName(event.target.value)}
          >
            {focusSeamRows.map((row) => (
              <option key={row.seamName} value={row.seamName}>
                {row.seamName} · {row.presentCount}/{loaded.length} boreholes · {row.items.length} picks
              </option>
            ))}
          </select>
        </div>
        <div className="selected-correlation-summary">
          <span>Selection</span>
          <div>
            <strong>{selectedIds.length} selected</strong>
            <small>{selectedBoreholes.map((item) => item.code).join(", ") || "No boreholes selected"}</small>
          </div>
        </div>
        <div className="correlation-reference-control">
          <span>Reference</span>
          <select
            value={referenceId ?? ""}
            disabled={!selectedBoreholes.length}
            onChange={(event) => setReferenceId(Number(event.target.value) || null)}
          >
            {selectedBoreholes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code}
              </option>
            ))}
          </select>
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
          <div
            className="correlation-column-grid"
            style={
              {
                "--corr-column-count": Math.max(loaded.length, 1),
                "--corr-min-grid-width": `${correlationGridMinWidth(loaded.length)}px`,
              } as CSSProperties
            }
          >
            <SeamTieLineOverlay lines={drawableTieLines} columnCount={loaded.length} />
            {loaded.map((data) => (
              <CorrelationColumn
                key={data.id}
                data={data}
                domain={domain}
                alignMode={alignMode}
                focusSeamName={selectedSeamRow?.seamName ?? ""}
                onOpenWorkbench={onOpenWorkbench}
              />
            ))}
          </div>
          {!loaded.length && <div className="empty">Select boreholes to build a correlation display.</div>}
        </div>
      </div>
      {insightsOpen && (
        <CorrelationInsightsDialog
          insights={insights}
          aiSummary={correlationAiSummary.data}
          aiLoading={correlationAiSummary.isLoading || correlationAiSummary.isFetching}
          aiError={correlationAiSummary.error instanceof Error ? correlationAiSummary.error.message : null}
          onRefreshAi={() => void correlationAiSummary.refetch()}
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
          onOpenWorkbench={onOpenWorkbench}
          onSaveNote={(text) => saveObservation.mutate(text)}
        />
      )}
    </section>
  );
}

function defaultFocusSeam(rows: SeamCorrelationRow[]): SeamCorrelationRow {
  return (
    rows.find((row) => !isGenericCorrelationMarker(row.seamName)) ??
    rows[0]
  );
}

function providerStatusText(summary: CorrelationAiSummary): string {
  const provider = summary.metrics.ai_provider;
  if (typeof provider !== "object" || provider === null) return "Assistant narrative ready";
  const details = provider as Record<string, unknown>;
  return details.used_for_summary ? "Generated by local model" : "Rule narrative fallback";
}

function isGenericCorrelationMarker(name: string): boolean {
  const normalized = name.trim().toUpperCase();
  return normalized === "BAND" || normalized === "UNNAMED" || normalized.length <= 2;
}

function seamMarkerName(name: string | null | undefined): string {
  return (name || "Unnamed seam").trim().toUpperCase();
}

function correlationGridMinWidth(columnCount: number): number {
  const count = Math.max(1, columnCount);
  return count * 150 + Math.max(0, count - 1) * 12;
}

function SeamTieLineOverlay({ lines, columnCount }: { lines: CorrelationTieLine[]; columnCount: number }) {
  if (columnCount < 2 || !lines.length) return null;
  const columnCenter = (index: number) => ((index + 0.5) / columnCount) * 100;
  return (
    <svg className="correlation-tie-lines" aria-hidden="true" preserveAspectRatio="none">
      {lines.map((line) => (
        <line
          key={line.id}
          className={`correlation-tie-line ${line.status}`}
          x1={`${columnCenter(line.fromColumn)}%`}
          x2={`${columnCenter(line.toColumn)}%`}
          y1={`${line.fromY}%`}
          y2={`${line.toY}%`}
        >
          <title>
            {line.seamName}: {line.offset.toFixed(1)}m adjacent seam offset
          </title>
        </line>
      ))}
    </svg>
  );
}

function CorrelationInsightsDialog({
  insights,
  aiSummary,
  aiLoading,
  aiError,
  onRefreshAi,
  seamRows,
  collarRows,
  boreholeCount,
  reviewedInsightIds,
  savedNotes,
  notesLoading,
  savePending,
  onClose,
  onMarkReviewed,
  onOpenWorkbench,
  onSaveNote,
}: {
  insights: CorrelationInsight[];
  aiSummary: CorrelationAiSummary | undefined;
  aiLoading: boolean;
  aiError: string | null;
  onRefreshAi: () => void;
  seamRows: SeamCorrelationRow[];
  collarRows: CollarContextRow[];
  boreholeCount: number;
  reviewedInsightIds: Set<string>;
  savedNotes: CorrelationObservation[];
  notesLoading: boolean;
  savePending: boolean;
  onClose: () => void;
  onMarkReviewed: (insightId: string) => void;
  onOpenWorkbench: (id: number, focusDepth?: number | null) => void;
  onSaveNote: (text: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div className="correlation-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="correlation-dialog">
        <header>
          <div>
            <strong>AI Correlation Insights</strong>
            <span>{aiSummary ? providerStatusText(aiSummary) : aiLoading ? "Local model is preparing the narrative" : "Rules plus local model narrative"}</span>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="correlation-dialog-grid">
          <section className="correlation-insights">
            <div className="correlation-ai-narrative">
              <div className="correlation-section-title">
                <strong>Assistant Narrative</strong>
                <span>{aiLoading ? "Generating..." : aiSummary ? "Ready" : "Not generated"}</span>
              </div>
              <div className="correlation-ai-actions">
                <small>Generated from computed seam continuity, marker, curve, coordinate, and RL metrics.</small>
                <button type="button" onClick={onRefreshAi} disabled={aiLoading}>
                  {aiLoading ? "Generating..." : "Refresh narrative"}
                </button>
              </div>
              {aiLoading && <p>Preparing correlation guidance from selected boreholes...</p>}
              {aiError && <p className="correlation-warning-text">{aiError}</p>}
              {!aiLoading && !aiError && <p>{aiSummary?.summary ?? "Open this panel with selected boreholes to generate a local AI narrative."}</p>}
            </div>
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
                  <small className="correlation-action">Action: {insight.action}</small>
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
                      disabled={savePending}
                      onClick={() => {
                        onSaveNote(correlationInsightObservationText(insight));
                        onMarkReviewed(insight.id);
                      }}
                    >
                      {savePending ? "Saving..." : correlationDecisionPrompt(insight)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNote(correlationInsightObservationText(insight))}
                    >
                      Draft note
                    </button>
                    {insight.target && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenWorkbench(insight.target!.boreholeId, insight.target!.depth);
                          onClose();
                        }}
                      >
                        Open {insight.target.boreholeCode} at {insight.target.depth.toFixed(1)}m
                      </button>
                    )}
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
                    <b>{row.borehole}{row.isReference ? " · REF" : ""}</b>
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
  focusSeamName,
  onOpenWorkbench,
}: {
  data: BoreholeWorkbench;
  domain: { min: number; max: number };
  alignMode: AlignMode;
  focusSeamName: string;
  onOpenWorkbench: (id: number, focusDepth?: number | null) => void;
}) {
  const meta = metadataFor(data);
  const gamma = data.curves.find(isGammaCurve);
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
            const focused = seamMarkerName(seam.name) === focusSeamName;
            return (
              <span key={seam.id} className={focused ? "focus" : "context"} style={{ top: `${y}%` }}>
                {focused && <b>{seam.name}</b>}
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
