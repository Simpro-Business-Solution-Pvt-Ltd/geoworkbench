import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { FieldPwaApp } from "./field/FieldPwaApp";
import "./styles.css";

const queryClient = new QueryClient();
const RootApp = window.location.pathname.startsWith("/field") ? FieldPwaApp : App;

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RootApp />
    </QueryClientProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // PWA support is best-effort; API health remains the source of runtime status.
    });
  });
}
