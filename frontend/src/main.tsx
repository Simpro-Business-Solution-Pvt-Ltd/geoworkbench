import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Agentation } from "agentation";
import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { FieldPwaApp } from "./field/FieldPwaApp";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
const RootApp = window.location.pathname.startsWith("/field") ? FieldPwaApp : App;

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RootApp />
      {import.meta.env.DEV && <Agentation />}
    </QueryClientProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA support is best-effort; API health remains the source of runtime status.
    });
  });
}
