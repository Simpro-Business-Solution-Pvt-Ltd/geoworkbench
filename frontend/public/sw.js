const CACHE_PREFIX = "geoworkbench-";
const SHELL_CACHE = "geoworkbench-shell-v4";
const STATIC_CACHE = "geoworkbench-static-v4";
const ALLOWED_CACHES = new Set([SHELL_CACHE, STATIC_CACHE]);
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
    caches.open(SHELL_CACHE).then((cache) =>
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
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !ALLOWED_CACHES.has(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (isProtectedOrDynamicPath(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  if (isHashedStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.pathname.startsWith("/branding/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

function isProtectedOrDynamicPath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/assets/corebox/") ||
    pathname.startsWith("/uploads/") ||
    pathname.startsWith("/exports/") ||
    pathname === "/sw.js"
  );
}

function isHashedStaticAsset(pathname) {
  return /^\/assets\/[^/]+-[A-Za-z0-9_-]+\.(js|css|woff2|png|svg)$/.test(pathname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheablePublicResponse(response)) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cached = await caches.match(request);
  const refresh = fetch(request).then(async (response) => {
    if (isCacheablePublicResponse(response)) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  });

  if (cached) {
    event.waitUntil(refresh.catch(() => undefined));
    return cached;
  }
  return refresh;
}

function isCacheablePublicResponse(response) {
  const cacheControl = response.headers.get("Cache-Control") ?? "";
  return response.ok && response.type !== "opaque" && !/no-store|private/i.test(cacheControl);
}
