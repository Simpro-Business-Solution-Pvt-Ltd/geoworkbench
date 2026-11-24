export type WorkbenchRealtimeEvent = {
  type: string;
  borehole_id: number | null;
  entity: string | null;
  operation: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
};

export type RealtimeQueryKey = readonly unknown[];

export function boreholeEventsUrl(boreholeId: number, token: string): string {
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const base = `${protocol}//${window.location.host}`;
  const params = new URLSearchParams({ token });
  return `${base}/api/realtime/boreholes/${boreholeId}/events?${params.toString()}`;
}

export function queryKeysForWorkbenchEvent(event: WorkbenchRealtimeEvent): RealtimeQueryKey[] {
  const boreholeId = event.borehole_id;
  const keys: RealtimeQueryKey[] = [];

  if (boreholeId !== null) {
    keys.push(queryKeys.workbench(boreholeId).slice(0, 2));
    keys.push(queryKeys.aiSummary(boreholeId));
    keys.push(queryKeys.exportReadiness(boreholeId));
    keys.push(queryKeys.exportJobs(boreholeId));
    keys.push(queryKeys.correlationAiRoot);
    if (eventTouchesCurveSamples(event)) {
      keys.push(queryKeys.curveSamplesRoot(boreholeId));
    }
  }

  if (event.entity === "borehole" || event.type.includes("borehole") || event.type.includes("mobile")) {
    keys.push(queryKeys.boreholes);
  }

  if (event.entity === "source_file" || event.type.includes("source_file")) {
    keys.push(queryKeys.boreholes);
  }

  if (event.entity === "import_profile" || event.type.includes("import_profile")) {
    keys.push(queryKeys.importProfiles);
  }

  if (event.entity === "export_profile" || event.type.includes("export_profile")) {
    keys.push(queryKeys.exportProfiles);
  }

  if (event.entity === "quality_settings" || event.type.includes("quality_settings")) {
    keys.push(queryKeys.qualitySettings);
    keys.push(queryKeys.workbenchRoot);
    keys.push(queryKeys.aiSummaryRoot);
    keys.push(queryKeys.exportReadinessRoot);
    keys.push(queryKeys.correlationAiRoot);
  }

  if (event.entity === "correlation_observation") {
    const boreholeIds = Array.isArray(event.payload.borehole_ids)
      ? event.payload.borehole_ids.filter((id): id is number => typeof id === "number")
      : [];
    if (boreholeIds.length) {
      keys.push(queryKeys.correlationObservations(boreholeIds.slice().sort((a, b) => a - b).join(":")));
    }
    keys.push(queryKeys.correlationAiRoot);
  }

  return dedupeQueryKeys(keys);
}

function eventTouchesCurveSamples(event: WorkbenchRealtimeEvent): boolean {
  return (
    event.entity === "curve" ||
    event.entity === "curve_sample" ||
    event.entity === "source_file" ||
    event.type.includes("curve") ||
    event.type.includes("source_file") ||
    event.type.includes("import")
  );
}

function dedupeQueryKeys(keys: RealtimeQueryKey[]): RealtimeQueryKey[] {
  const seen = new Set<string>();
  const unique: RealtimeQueryKey[] = [];
  for (const key of keys) {
    const signature = JSON.stringify(key);
    if (seen.has(signature)) continue;
    seen.add(signature);
    unique.push(key);
  }
  return unique;
}
import { queryKeys } from "../api/queryKeys";
