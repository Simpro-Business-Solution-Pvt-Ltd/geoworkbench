import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiProxy = {
  "/api": process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8081",
  "/assets/corebox": process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:8081",
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
  },
});
