import type { QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getAuthToken } from "../api/client";
import {
  boreholeEventsUrl,
  queryKeysForWorkbenchEvent,
  type WorkbenchRealtimeEvent,
} from "./workbenchRealtime";

type UseWorkbenchRealtimeArgs = {
  boreholeId: number | null | undefined;
  enabled: boolean;
  queryClient: QueryClient;
};

const RECONNECT_DELAY_MS = 4000;

export function useWorkbenchRealtime({ boreholeId, enabled, queryClient }: UseWorkbenchRealtimeArgs) {
  useEffect(() => {
    if (!enabled || !boreholeId) return undefined;
    const token = getAuthToken();
    if (!token) return undefined;

    let source: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;

    const connect = () => {
      source = new EventSource(boreholeEventsUrl(boreholeId, token));
      source.onmessage = (message) => {
        handleEventMessage(message.data, queryClient);
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        reconnectTimer = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      source?.close();
    };
  }, [boreholeId, enabled, queryClient]);
}

export function handleEventMessage(raw: string, queryClient: Pick<QueryClient, "invalidateQueries">) {
  const event = parseWorkbenchRealtimeEvent(raw);
  if (!event) return;
  for (const queryKey of queryKeysForWorkbenchEvent(event)) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function parseWorkbenchRealtimeEvent(raw: string): WorkbenchRealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<WorkbenchRealtimeEvent>;
    if (!parsed || typeof parsed.type !== "string") return null;
    return {
      type: parsed.type,
      borehole_id: typeof parsed.borehole_id === "number" ? parsed.borehole_id : null,
      entity: typeof parsed.entity === "string" ? parsed.entity : null,
      operation: typeof parsed.operation === "string" ? parsed.operation : null,
      payload: parsed.payload && typeof parsed.payload === "object" ? parsed.payload : {},
      occurred_at: typeof parsed.occurred_at === "string" ? parsed.occurred_at : "",
    };
  } catch {
    return null;
  }
}
