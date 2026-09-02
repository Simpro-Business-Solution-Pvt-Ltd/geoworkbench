const CACHE_NAME = "geoworkbench-shell-v3";
const APP_SHELL = [
  "/",
  "/field",
  "/manifest.webmanifest",
  "/branding/reliance-logo.png",
  "/branding/reliance-roundel.png",
  "/branding/reliance-icon-192.png",
  "/branding/reliance-icon-512.png",
  "/branding/simpro-favicon.png",
  "/branding/simpro-logo.png",
  "/branding/geoworkbench-icon-192.png",
  "/branding/geoworkbench-icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((error) => {
            console.warn("GeoWorkbench shell asset was not cached", url, error);
          }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
