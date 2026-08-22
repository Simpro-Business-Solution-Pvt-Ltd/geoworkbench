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
    keys.push(["workbench", boreholeId]);
    keys.push(["aiSummary", boreholeId]);
    keys.push(["exportReadiness", boreholeId]);
    keys.push(["exportJobs", boreholeId]);
    if (eventTouchesCurveSamples(event)) {
      keys.push(["curveSamples", boreholeId]);
    }
  }

  if (event.entity === "borehole" || event.type.includes("borehole") || event.type.includes("mobile")) {
    keys.push(["boreholes"]);
  }

  if (event.entity === "source_file" || event.type.includes("source_file")) {
    keys.push(["boreholes"]);
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
