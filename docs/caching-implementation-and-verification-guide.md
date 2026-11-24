# GeoWorkbench Caching Implementation and Verification Guide

Updated: 2026-09-06

## 1. Purpose

This document defines how caching should be introduced, secured, invalidated,
observed, and verified across the GeoWorkbench website.

It covers:

- React and TanStack Query browser caching;
- service-worker and PWA caching;
- HTTP and reverse-proxy cache headers;
- FastAPI response caching;
- Redis-backed shared caching and realtime invalidation;
- static frontend bundles, branding, core images, and export downloads;
- cache verification in development, UAT, and production;
- rollback and failure behavior.

The goal is not to cache every response. The goal is to cache data only when the
performance benefit is greater than the risk of serving stale or unauthorized
content.

## 2. Current State and Main Gaps

As of this document's update, GeoWorkbench has the following caching behavior.

| Layer | Current behavior | Assessment |
| --- | --- | --- |
| TanStack Query | Central defaults plus per-data-class TTLs and a shared query-key factory | Implemented; memory-only by design |
| Workbench invalidation | Local mutations and SSE events use matching key prefixes | Implemented and covered by frontend tests |
| Curve windows | Cached with a five-second `staleTime` | Reasonable initial policy |
| Correlation AI summary | One-minute browser freshness plus source-versioned Redis identity | Implemented with bounded freshness |
| Query persistence | Query cache is memory-only | Good for sensitive data; reloads do not retain server responses |
| Service worker | Explicit shell, hashed-build, manifest, and branding allowlist | Implemented; API/corebox/upload/export paths are network-only |
| Redis | Optional pooled client configured in development Compose | Implemented and fail-open |
| Backend response cache | Borehole list, workbench, curve windows, and AI summaries | Implemented with bounded TTLs and versioned keys |
| Realtime broker | Local delivery plus optional Redis pub/sub fan-out | Implemented for multi-instance refresh hints |
| HTTP headers | Central route policy plus IIS static-asset policy | Implemented for auth/API/download/corebox/shell/hashed assets |

### 2.1 Implemented files

- `frontend/src/api/queryKeys.ts` centralizes query identity;
- `frontend/src/main.tsx` defines safe memory-cache defaults;
- `frontend/public/sw.js` applies the public-resource allowlist;
- `frontend/public/web.config` applies IIS shell and immutable-asset headers;
- `backend/app/core/cache.py` provides fail-open Redis JSON caching and versions;
- `backend/app/core/realtime.py` distributes refresh events through Redis pub/sub;
- cacheable borehole and AI read routes emit `X-GeoWorkbench-Cache`;
- `backend/app/main.py` applies HTTP safety headers and reports cache diagnostics;
- `.env.example`, `.env.postgres.example`, and `docker-compose.dev.yml` document
  and enable the applicable settings.

The implementation intentionally does not cache authentication, diagnostics,
uploads, export downloads, SSE streams, or protected corebox image bytes.

Important existing files:

- `frontend/src/main.tsx` - TanStack Query client creation;
- `frontend/src/App.tsx` - primary queries, mutations, and invalidations;
- `frontend/src/realtime/workbenchRealtime.ts` - event-to-query-key mapping;
- `frontend/src/realtime/useWorkbenchRealtime.ts` - SSE subscription;
- `frontend/src/workbench/tracks/curve/useCurveWindowData.ts` - curve window cache;
- `frontend/src/workbench/correlation/CorrelationWorkspace.tsx` - correlation caches;
- `frontend/public/sw.js` - PWA cache;
- `backend/app/core/realtime.py` - current process-local event broker;
- `backend/app/core/config.py` - backend settings;
- `backend/app/main.py` - middleware and static asset mounting;
- `docker-compose.dev.yml` - Redis development service.

## 3. Required Cache Rules

Apply these rules before implementing any cache.

1. Never cache credentials, bearer tokens, OTPs, login responses, password
   operations, or authorization failures.
2. Never use a cache key that can mix data belonging to different users,
   tenants, roles, projects, boreholes, layouts, units, or query parameters.
3. Every mutable cached object must have a defined invalidation owner.
4. Every cache must have a bounded lifetime unless the asset is immutable and
   content-addressed, such as a hashed JavaScript bundle.
5. The database remains the source of truth. Redis and browser caches are
   disposable acceleration layers.
6. A Redis outage must not prevent ordinary reads or writes. Cache operations
   must fail open to the database and produce telemetry.
7. Service-worker caches must contain only explicitly allowed public shell
   assets. Do not cache authenticated API or domain content there.
8. Logout must clear in-memory server-state caches and any user-specific local
   state that should not survive sign-out.
9. Do not use wildcard Redis key scans on request paths. Use versioned keys or
   maintained key sets for bounded invalidation.
10. Treat cache freshness and authorization as separate checks. A cache hit must
    never bypass endpoint authorization.

## 4. Cache Classification

Use the following classification when adding or reviewing an endpoint.

| Data class | Examples | Browser policy | Redis policy | HTTP policy |
| --- | --- | --- | --- | --- |
| Authentication secrets | Login, OTP, bearer token, password reset | Do not cache | Do not cache | `no-store` |
| Current-user data | `/auth/me`, preferences | Memory only; short-lived | Usually do not cache | `private, no-store` |
| Authorization data | Roles, permissions, role access | 5-10 minutes with mutation invalidation | Optional short TTL with auth-version key | `private, no-cache` |
| Reference/config data | Import/export profiles, quality settings | 2-5 minutes with invalidation | 2-5 minutes | `private, no-cache` |
| Borehole list | Dashboard list and coordinates | 15-30 seconds | 15-60 seconds | `private, no-cache` |
| Workbench aggregate | Intervals, layouts, issues, curves | 10-30 seconds | 30-120 seconds with borehole version | `private, no-cache` |
| Curve sample windows | Visible-depth samples | 5-30 seconds | 1-5 minutes with curve version | `private, no-cache` |
| AI summary | Borehole/correlation summary | 30-120 seconds | 2-10 minutes with data/provider/settings versions | `private, no-cache` |
| Diagnostics | Health and timestamps | Always refresh | Do not cache | `no-store` |
| Export job status | Job lists and readiness | 5-15 seconds or polling | Optional 5-15 seconds | `private, no-cache` |
| Export download | Generated file | Do not store in browser/PWA | Do not cache bytes in Redis | `private, no-store` |
| Core/domain images | Corebox photographs | Browser HTTP cache only when authorized | Do not store bytes in Redis initially | `private, no-cache` or short private TTL |
| Hashed frontend assets | `index-<hash>.js`, CSS, fonts | Cache-first | Not applicable | `public, max-age=31536000, immutable` |
| HTML and service worker | `index.html`, `sw.js` | Network-first | Not applicable | `no-cache` or `max-age=0, must-revalidate` |
| Public branding | Logos and PWA icons | Cache-first, versioned | Not applicable | Long bounded public TTL |

TTL values are starting points. Adjust them using measured hit rate, database
load, response time, and accepted staleness—not intuition alone.

## 5. Target Request and Invalidation Flow

```text
Browser component
  -> TanStack Query cache
      -> HTTP request when stale/missing
          -> FastAPI authorization
              -> Redis cache-aside lookup
                  -> cache hit: deserialize and return
                  -> cache miss: query PostgreSQL, serialize, cache, return

Successful mutation
  -> commit PostgreSQL transaction
  -> increment affected Redis version(s)
  -> publish domain event through Redis pub/sub
      -> every API instance receives event
      -> connected browsers receive SSE event
      -> browsers invalidate affected TanStack Query keys
      -> next read repopulates browser and Redis caches
```

Do not invalidate or publish before the database transaction commits. Otherwise,
a concurrent reader can refill the cache with the old database value.

## 6. Phase 0 - Establish Baselines

Complete this phase before changing behavior.

### 6.1 Capture current measurements

Measure at least these endpoints with a representative UAT dataset:

- `GET /api/boreholes`;
- `GET /api/boreholes/{id}/workbench`;
- `GET /api/boreholes/{id}/curves/{key}/samples`;
- `GET /api/ai/boreholes/{id}/summary`;
- `POST /api/ai/correlation/summary`;
- `GET /api/exports/boreholes/{id}/readiness`.

For each endpoint, record:

- p50, p95, and p99 response time;
- response size;
- SQL query count and database time;
- request rate under normal and peak use;
- acceptable maximum staleness;
- whether the result varies by user, role, project, layout, or parameters.

Store results in the UAT evidence pack. Do not declare caching successful using
response time from a single local request.

### 6.2 Define a cache inventory

For every proposed cache, create an inventory row:

| Cache name | Owner | Key shape | TTL | Invalidation events | Sensitive? | Failure fallback |
| --- | --- | --- | --- | --- | --- | --- |
| Workbench | Borehole domain | borehole, layout, versions | 60 s | interval/layout/import/AI/validation | Yes | Database |
| Curve window | Borehole domain | borehole, curve, depth range, max samples, version | 180 s | curve/source-file/import | Yes | Database |
| Borehole list | Borehole domain | project/scope, version | 30 s | borehole/mobile/import/status | Yes | Database |
| AI summary | AI domain | borehole, data/settings/provider versions | 300 s | interval/import/validation/AI/settings | Yes | Recompute |

This inventory is part of the feature definition. A cache without an owner or
invalidation event is not ready for production.

## 7. Phase 1 - Make TanStack Query Policies Explicit

### 7.1 Create central query defaults

Configure the `QueryClient` in `frontend/src/main.tsx`. Suggested starting point:

```ts
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
```

Override these values per data class. Examples:

- diagnostics: `staleTime: 0`, retain the existing polling interval;
- borehole list: `staleTime: 30_000`;
- stable permissions: `staleTime: 5 * 60_000`;
- workbench: `staleTime: 15_000`;
- curve windows: `staleTime: 5_000` initially;
- correlation AI: replace `Infinity` with a bounded value such as `60_000`.

Keep the query cache memory-only. Do not add local-storage persistence for API
responses unless an approved offline-data design includes encryption, retention,
logout cleanup, migrations, and user scoping.

### 7.2 Centralize query keys

Create a query-key factory, for example `frontend/src/api/queryKeys.ts`:

```ts
export const queryKeys = {
  authSession: ["authSession"] as const,
  boreholes: ["boreholes"] as const,
  workbenchRoot: ["workbench"] as const,
  workbench: (boreholeId: number, layoutId: number | null = null) =>
    ["workbench", boreholeId, layoutId] as const,
  curveSamplesRoot: (boreholeId: number) => ["curveSamples", boreholeId] as const,
  aiSummary: (boreholeId: number) => ["aiSummary", boreholeId] as const,
  exportReadiness: (boreholeId: number) => ["exportReadiness", boreholeId] as const,
  exportJobs: (boreholeId: number) => ["exportJobs", boreholeId] as const,
  correlationObservations: (setKey: string) => ["correlation-observations", setKey] as const,
  correlationAiRoot: ["correlation-ai-summary"] as const,
};
```

All queries, mutations, and realtime mappings must use the same factory. This
prevents a spelling or key-shape mismatch from silently leaving stale data.

### 7.3 Define the mutation invalidation matrix

The following minimum invalidations are required.

| Mutation/event | Required browser invalidations |
| --- | --- |
| Interval update | workbench, AI summary, export readiness, affected correlation AI |
| Validation run | workbench, AI summary, export readiness |
| AI suggestion generate/update/accept | workbench, AI summary; export readiness if acceptance changes approval readiness |
| Display layout create/update/delete/reset | all workbench variants for the borehole |
| Source file upload/register/process | workbench, borehole list; curve windows if samples can change |
| Source file merge/import | workbench, borehole list, curve windows, AI summary, export readiness, affected correlation AI |
| Borehole approval/status update | borehole list, workbench, export readiness |
| Export created/status changed | export jobs, export readiness |
| Import/export profile update | corresponding profile list |
| Quality setting update/reset | quality settings, all workbench summaries, all AI summaries, all export readiness, correlation AI |
| Correlation observation create | matching observation set; correlation AI if observations contribute to the prompt/result |
| User/role/access update | users, roles, role access, permissions as applicable, current session if affected |

Use prefix invalidation when a mutation changes every layout or depth-window
variant for a borehole:

```ts
await queryClient.invalidateQueries({
  queryKey: ["workbench", boreholeId],
});

await queryClient.invalidateQueries({
  queryKey: ["curveSamples", boreholeId],
});
```

### 7.4 Prefer response-driven updates where safe

For a mutation returning a complete canonical object, use `setQueryData` to make
the UI immediately consistent, followed by invalidation when aggregate fields
may also change.

Do not build optimistic updates for operations that can fail validation or cause
complex server-side changes until rollback behavior is covered by tests.

### 7.5 Verify the browser query cache

Automated tests must prove:

1. Two components requesting the same key concurrently cause one network call.
2. Remounting within `staleTime` uses cached data without another request.
3. Remounting after `staleTime` returns cached data and refreshes it.
4. Window focus and reconnect refresh stale active queries.
5. Each mutation invalidates every key in the matrix.
6. An SSE event maps to the same keys as the equivalent local mutation.
7. Logout calls `queryClient.clear()` and no previous user's response remains.
8. Query keys differ when layout, borehole, curve, depth range, or other response
   parameters differ.

Use Vitest with a fresh `QueryClient` per test and MSW or a deterministic fetch
mock. Assert request counts and cache contents, not only rendered text.

## 8. Phase 2 - Restrict and Version the Service-Worker Cache

### 8.1 Use an allowlist

The service worker must cache only:

- the offline application shell;
- the manifest;
- public branding icons;
- same-origin hashed build files under `/assets/` only when the path represents
  frontend build output, not backend domain files.

The current `/assets/corebox` route must be excluded explicitly. API endpoints,
export downloads, uploaded images, source files, and any response containing user
or borehole data must never be stored in Cache Storage.

Recommended decision function:

```js
function isPublicCacheableAsset(request, url) {
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/")) return false;
  if (url.pathname.startsWith("/assets/corebox/")) return false;
  if (url.pathname.startsWith("/uploads/")) return false;
  if (url.pathname.startsWith("/exports/")) return false;
  return (
    url.pathname.startsWith("/branding/") ||
    /^\/assets\/[^/]+-[A-Za-z0-9_-]+\.(js|css|woff2|png|svg)$/.test(url.pathname)
  );
}
```

If frontend and backend assets continue to share `/assets`, move one category to
a distinct path. `/static/` for public frontend build output and `/domain-assets/`
for protected geology content is less error-prone.

### 8.2 Use the correct strategy per resource

| Resource | Strategy |
| --- | --- |
| Navigation/HTML | Network-first; cached shell only as offline fallback |
| `sw.js` | Network; never cache-first |
| Hashed JS/CSS/font files | Cache-first because URL changes with content |
| Public branding | Stale-while-revalidate or bounded cache-first |
| API and authenticated assets | Network-only |

Check `response.type`, `response.ok`, origin, path, and cache-control before
calling `cache.put`. Never cache opaque cross-origin responses by default.

### 8.3 Version and clean caches

Use separate names, for example:

```js
const SHELL_CACHE = "geoworkbench-shell-v4";
const STATIC_CACHE = "geoworkbench-static-v4";
const ALLOWED_CACHES = new Set([SHELL_CACHE, STATIC_CACHE]);
```

During activation, delete only old GeoWorkbench-owned caches. Do not delete cache
names owned by another application sharing the origin.

Generate or update the revision when the shell content changes. A manually
maintained version is acceptable initially only if release instructions require
updating it and CI verifies the version changed when `APP_SHELL` changes.

### 8.4 Handle updates predictably

`skipWaiting()` and `clients.claim()` activate new code quickly, but an already
open page may still reference old assets. Add an update notification or reload
the page once when `controllerchange` fires. Prevent reload loops with a session
flag.

### 8.5 Service-worker verification

Run these checks in a clean browser profile against a production build:

1. Open DevTools > Application > Service Workers and confirm one active worker.
2. Inspect Cache Storage. Only approved shell/static URLs should appear.
3. Confirm no URL beginning with `/api/`, `/assets/corebox/`, `/uploads/`, or an
   export download path exists in Cache Storage.
4. Go offline and reload `/field`; the shell should open.
5. While offline, verify server data displays an offline/error state rather than
   stale data that was never approved for offline use.
6. Sign in, open core images, sign out, go offline, and confirm those images are
   not available from Cache Storage.
7. Deploy a build with a new cache revision and changed UI marker. Reload and
   confirm the new UI appears and obsolete GeoWorkbench caches are removed.
8. Confirm a failed asset response, redirect, 401, 403, or 404 is not cached.

Automate route classification as a unit test even if full service-worker browser
tests are deferred.

## 9. Phase 3 - Add Explicit HTTP Cache Headers

Headers protect against unintended browser, IIS, Nginx, and intermediary caching.
They are required even when TanStack Query already caches in memory.

### 9.1 FastAPI policy

Add centralized middleware or response helpers with these defaults:

```text
/api/auth/*                         Cache-Control: no-store
/api/diagnostics/*                  Cache-Control: no-store
/api/realtime/*                     Cache-Control: no-cache
/api/* authenticated JSON          Cache-Control: private, no-cache
/api/exports/jobs/*/download        Cache-Control: private, no-store
/assets/corebox/*                   Cache-Control: private, no-cache
```

Also add `X-Content-Type-Options: nosniff` where appropriate. If a response varies
by authentication or encoding, set a correct `Vary` header. Do not set `public`
on authenticated responses.

`no-cache` permits storage but requires revalidation. `no-store` prohibits
storage. Use `no-store` for secrets and downloads; use private revalidation for
ordinary authenticated data when appropriate.

### 9.2 Static frontend policy

Configure IIS or Nginx:

```text
/index.html              no-cache
/sw.js                   no-cache
/manifest.webmanifest    no-cache or short bounded TTL
/assets/*-<hash>.*       public, max-age=31536000, immutable
/branding/*              public, max-age=86400 (or version filenames and use longer)
```

Never apply the immutable `/assets` rule to proxied `/assets/corebox`. Separate
the route or place its proxy rule before static cache-header rules.

### 9.3 Header verification

Use browser Network tools and command-line checks:

```powershell
curl.exe -I https://geoworkbench.example.com/
curl.exe -I https://geoworkbench.example.com/sw.js
curl.exe -I https://geoworkbench.example.com/assets/index-<hash>.js
curl.exe -I https://geoworkbench.example.com/assets/corebox/<path>
curl.exe -i -H "Authorization: Bearer <redacted-test-token>" `
  https://geoworkbench.example.com/api/boreholes
```

Expected results:

- HTML and service worker revalidate;
- hashed assets are public and immutable;
- authenticated API responses are private or no-store;
- domain assets are never public;
- responses do not contain contradictory cache directives.

Do not paste real production tokens into tickets or retained console logs.

## 10. Phase 4 - Introduce Redis Cache-Aside Reads

### 10.1 Add configuration

Add backend settings such as:

```text
GEOWORKBENCH_REDIS_URL=redis://127.0.0.1:6379/0
GEOWORKBENCH_CACHE_ENABLED=true
GEOWORKBENCH_CACHE_PREFIX=geoworkbench
GEOWORKBENCH_CACHE_DEFAULT_TTL_SECONDS=60
GEOWORKBENCH_CACHE_CONNECT_TIMEOUT_SECONDS=1
GEOWORKBENCH_CACHE_SOCKET_TIMEOUT_SECONDS=1
```

Add a Redis client dependency to `backend/pyproject.toml`. Create one application
client/pool during startup and close it during shutdown. Do not create a new
connection per request.

Add a Redis healthcheck in Compose and make backend dependency conditional only
if local startup truly requires it. Production reads should still fail open if
Redis becomes unavailable after startup.

### 10.2 Build a small cache abstraction

Create a backend cache module with:

- `get_json(key)`;
- `set_json(key, value, ttl_seconds)`;
- `delete(key)` for bounded exact deletions;
- `get_version(scope)` and `increment_version(scope)`;
- metrics for hit, miss, error, serialization failure, and latency;
- namespaced keys containing environment and schema version;
- fail-open exception handling.

Do not spread direct Redis calls throughout routers and services. Domain services
should own key composition and invalidation.

Suggested prefix:

```text
geoworkbench:<environment>:v1:<data-class>:<identity-and-version>
```

Never put bearer tokens, passwords, personal names, or raw prompt text in keys.
Hash high-cardinality normalized input with SHA-256.

### 10.3 Use versioned cache keys

Versioned keys avoid expensive wildcard deletion.

Example:

```text
version:borehole:42:data                    -> 18
version:borehole:42:curves                  -> 7
version:borehole-list:project:RELIANCE      -> 12
version:quality-settings                    -> 3

workbench:42:layout:9:data-v18:quality-v3
curve-window:42:GR:100.000:140.000:2000:curve-v7
```

After an interval write commits, increment the borehole data version. Old values
expire naturally and are no longer addressable. Keep TTLs bounded so abandoned
versions do not accumulate indefinitely.

### 10.4 Implement endpoints in order

Introduce caching gradually:

1. Curve sample windows: high read volume, clear key inputs, straightforward
   invalidation.
2. Borehole workbench aggregate: cache only after versioning and mutation
   coverage are tested.
3. Borehole list: include project/authorization scope in the key.
4. AI summaries: include source data, quality settings, provider, model, prompt
   schema, and request parameter versions.
5. Stable reference/config endpoints if measurement shows a benefit.

Do not initially cache:

- auth/session endpoints;
- diagnostics;
- mutation responses;
- live export-job status unless using a very short TTL;
- export file bytes;
- source upload bodies;
- SSE streams.

### 10.5 Cache-aside algorithm

For each cacheable read:

1. Authorize the request normally.
2. Normalize all response-affecting parameters.
3. Load required version counters.
4. Build the namespaced key.
5. Attempt Redis `GET`.
6. On a valid hit, deserialize and return.
7. On miss or Redis error, execute the existing database/service path.
8. Serialize the completed response schema.
9. Store it with a TTL and small random jitter.
10. Return the canonical response.

TTL jitter, for example plus or minus 10%, reduces simultaneous expiry of many
popular keys.

For expensive AI calls, add a short distributed lock or single-flight mechanism
to prevent a cache stampede. Lock acquisition failure should wait briefly and
retry the cache, then compute as a safe fallback. Locks must always expire.

### 10.6 Invalidate after committed writes

Map backend writes to version increments using the same domain matrix as the
frontend. The invalidation must happen after `db.commit()` succeeds.

If the database commit succeeds but Redis invalidation fails:

- return the successful mutation unless product requirements say otherwise;
- log and count the cache invalidation failure;
- publish a best-effort event;
- rely on the bounded TTL as the safety net;
- alert if failures cross the configured threshold.

## 11. Phase 5 - Replace Process-Local Realtime with Redis Pub/Sub

This is required before running multiple FastAPI workers or multiple API servers.

### 11.1 Target behavior

1. A mutation commits to PostgreSQL.
2. The handling API instance increments cache versions.
3. It publishes a compact domain event to a Redis channel.
4. Every API instance subscribes to that channel.
5. Each instance forwards matching events to its local SSE subscribers.
6. Browsers invalidate TanStack Query keys and refetch when active.

Do not send full confidential domain records through pub/sub. Send identifiers,
entity, operation, versions, actor-safe metadata, and timestamp.

### 11.2 Delivery assumptions

Redis pub/sub is ephemeral. That is acceptable for refresh hints because:

- Redis cache entries have bounded TTLs;
- reconnect/focus policies eventually refresh browser state;
- the database remains authoritative.

If events become workflow/audit guarantees, use Redis Streams or another durable
broker instead of pub/sub.

### 11.3 Multi-instance verification

Run two API instances against the same PostgreSQL and Redis:

1. Connect browser A's SSE request to instance A.
2. Send a mutation through instance B.
3. Verify instance A receives the Redis event.
4. Verify browser A receives the SSE event.
5. Verify the correct query keys are invalidated and the updated value appears.
6. Stop Redis and verify normal database reads/writes continue with warnings.
7. Restore Redis and verify subscribers reconnect without restarting the browser.

## 12. Phase 6 - Authorization and Sensitive Asset Handling

The current corebox asset mount is a plain static route. Before relying on private
cache headers, decide whether core images require endpoint authorization.

Recommended design:

1. Serve domain assets through an authorized API route or short-lived signed URL.
2. Check the user's access to the associated project/borehole before returning
   the file.
3. Use `Cache-Control: private, no-cache` for ordinary browser revalidation, or
   `private, max-age=<short TTL>` only after security approval.
4. Do not store these responses in the service worker.
5. Do not include user-specific signed query strings in shared proxy caches.
6. Ensure logout and access revocation are tested against previously viewed
   images.

Caching policy cannot repair an unauthenticated asset endpoint. Authorization
must be correct before private caching is optimized.

## 13. Automated Verification Suite

### 13.1 Frontend unit tests

Add tests for:

- query-key factory uniqueness and normalization;
- mutation invalidation matrix;
- realtime event mapping parity with mutations;
- correlation AI expiry and invalidation;
- curve-window parameter rounding/key behavior;
- service-worker route allowlist and denylist;
- query cache clearing on both standard and field-PWA logout.

Run:

```powershell
cd frontend
npm run test:unit
npm run build
```

### 13.2 Backend unit tests

Use a fake Redis client to test:

- key construction;
- environment/schema namespacing;
- version increments;
- serialization round-trip;
- TTL application and jitter bounds;
- Redis exceptions falling back to the database;
- no caching of auth/diagnostic/download endpoints;
- invalidation only after successful commit;
- no invalidation when a transaction rolls back.

### 13.3 Backend integration tests

Run PostgreSQL and Redis containers and test:

1. First request is a miss and reads PostgreSQL.
2. Second identical request is a hit and returns the same body.
3. A response-affecting parameter change produces a miss.
4. A user/access-scope change cannot retrieve another scope's result.
5. A mutation increments the correct version.
6. The next read returns updated data and creates a new cache entry.
7. Old versioned keys expire.
8. Redis outage falls back within the required latency/error threshold.
9. Malformed cached JSON is ignored, counted, and replaced.
10. Simultaneous misses do not create uncontrolled duplicate expensive work.

### 13.4 Browser end-to-end tests

Use Playwright or the project's chosen browser runner against a production build.
Cover:

- online first load;
- repeated navigation and request counts;
- mutation followed by immediate updated display;
- SSE change from a second browser session;
- offline shell startup;
- prohibited resources absent from Cache Storage;
- service-worker upgrade;
- sign-out followed by offline navigation;
- user A sign-out followed by user B sign-in on the same browser.

## 14. Manual Verification Runbook

### 14.1 Start the development stack

```powershell
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml ps
```

Confirm PostgreSQL, Redis, backend, and frontend are healthy. If the backend is
configured to treat Redis as optional, also document that readiness is healthy
with a degraded cache status when Redis is unavailable.

### 14.2 Inspect Redis

Use a development or UAT Redis only:

```powershell
docker compose -f docker-compose.dev.yml exec redis redis-cli PING
docker compose -f docker-compose.dev.yml exec redis redis-cli INFO stats
docker compose -f docker-compose.dev.yml exec redis redis-cli INFO memory
docker compose -f docker-compose.dev.yml exec redis redis-cli --scan --pattern "geoworkbench:*"
```

Expected:

- `PING` returns `PONG`;
- keys use the documented environment/schema prefix;
- cache hits increase on repeated reads;
- keys have a positive TTL;
- no keys contain tokens, passwords, email addresses, or raw prompt text;
- memory remains within the configured limit.

Inspect a key's lifetime without copying sensitive value content:

```powershell
docker compose -f docker-compose.dev.yml exec redis redis-cli TTL <test-key>
```

Avoid `KEYS *` outside an isolated development database.

### 14.3 Confirm a cold miss and warm hit

1. Choose a test borehole and record its ID.
2. Capture Redis hit/miss counters.
3. Request its workbench once; confirm a cache miss and database execution.
4. Request the exact same URL as the same access scope.
5. Confirm a cache hit, identical response semantics, and lower server time.
6. Change the layout parameter and confirm it does not reuse the previous result.
7. Wait past TTL and confirm a miss/repopulation.

Do not require byte-for-byte equality for fields intentionally containing request
timestamps. Such fields should usually be excluded from cacheable responses.

For a local backend on port `8081`, the header check can be repeated exactly as
follows (change the borehole ID to one that exists):

```powershell
$BaseUrl = "http://localhost:8081"
curl.exe -sS -D - -o NUL -w "time=%{time_total}s status=%{http_code}`n" "$BaseUrl/api/boreholes"
curl.exe -sS -D - -o NUL -w "time=%{time_total}s status=%{http_code}`n" "$BaseUrl/api/boreholes"
curl.exe -sS -D - -o NUL -w "time=%{time_total}s status=%{http_code}`n" "$BaseUrl/api/boreholes/1/workbench"
curl.exe -sS -D - -o NUL -w "time=%{time_total}s status=%{http_code}`n" "$BaseUrl/api/boreholes/1/workbench"
curl.exe -sS "$BaseUrl/api/diagnostics/health"
```

The first matching request must contain `X-GeoWorkbench-Cache: MISS`; the second
must contain `HIT`. Both must remain `200`, use `Cache-Control: private,
no-cache`, and include `Vary: Authorization`. `BYPASS` means caching is disabled
or its circuit breaker is open; `ERROR` means that request encountered a cache
error and safely used the database.

### 14.4 Confirm mutation invalidation

For every row in the invalidation matrix:

1. Warm the affected caches.
2. Record relevant version values and browser query state.
3. Perform the mutation.
4. Confirm the database commit succeeded.
5. Confirm the affected Redis version increments exactly once.
6. Confirm an SSE event is received.
7. Confirm the browser invalidates and refetches active queries.
8. Confirm the response shows the updated value.
9. Confirm unrelated cache versions and queries remain unchanged.

### 14.5 Confirm failure behavior

In a controlled development/UAT environment:

1. Warm several caches.
2. Stop Redis.
3. Request cached endpoints; they must read from PostgreSQL, not return 500.
4. Perform an ordinary mutation; the database change must succeed.
5. Confirm cache errors are logged without secrets.
6. Restart Redis.
7. Confirm the client reconnects and new cache entries are populated.
8. Confirm no stale pre-outage result overwrites newer data.

To test a reachable-but-unresponsive Redis container, use `pause` rather than
`stop`. This preserves Docker DNS and tests the configured Redis socket timeout:

```powershell
docker pause geoworkbench-redis-1
curl.exe -sS -D - -o NUL -w "time=%{time_total}s status=%{http_code}`n" http://localhost:8081/api/boreholes
curl.exe -sS -D - -o NUL -w "time=%{time_total}s status=%{http_code}`n" http://localhost:8081/api/boreholes
docker unpause geoworkbench-redis-1
```

The first response should be `200` with `BYPASS` after at most the configured
socket timeout. The immediate second response should also be `200` with
`BYPASS`, but much faster because the failure circuit is open. Always unpause or
restart Redis after the test.

### 14.6 Confirm service-worker safety

1. Build and serve the production frontend.
2. Clear site data and reload.
3. List Cache Storage entries in DevTools.
4. Sign in and open a borehole, curves, core images, and an export.
5. Recheck Cache Storage.
6. Fail the test if API JSON, core imagery, an export, or authenticated upload is
   present.
7. Sign out and enable offline mode.
8. Confirm the public shell can open but protected data cannot be retrieved.

## 15. Observability

Expose or record these metrics by cache name and endpoint class:

- cache requests;
- hits, misses, and hit ratio;
- Redis operation latency;
- cache serialization/deserialization errors;
- cache fallback count;
- invalidation/version increment successes and failures;
- current connection-pool usage;
- database queries avoided;
- application response p50/p95/p99;
- AI single-flight lock contention;
- SSE/pub-sub event count and reconnect count.

Do not put borehole codes, usernames, tokens, raw keys, or high-cardinality request
parameters into metric labels.

Suggested response diagnostics for non-production or authorized administrators:

```text
X-GeoWorkbench-Cache: HIT | MISS | BYPASS | ERROR
X-GeoWorkbench-Cache-Age: <seconds>
```

Do not expose internal Redis keys. These headers can be disabled in production if
they disclose implementation detail beyond the accepted threat model.

Alert examples:

- Redis error/fallback rate above 1% for five minutes;
- hit ratio unexpectedly falls below the endpoint's measured baseline;
- p95 latency regresses after cache rollout;
- invalidation failures occur after successful mutations;
- Redis memory usage exceeds 80% of its configured maximum;
- evictions occur for caches that require their expected TTL window;
- pub/sub subscribers drop to zero on an active API instance.

## 16. Redis Operational Configuration

For a cache-only Redis deployment:

- set an explicit `maxmemory` appropriate to measured data volume;
- choose an eviction policy such as `allkeys-lru` or `allkeys-lfu` after load
  testing;
- use authentication/TLS or a private network according to deployment policy;
- never expose Redis directly to user networks;
- use a dedicated database or instance/prefix for GeoWorkbench;
- keep timeouts short so fallback is fast;
- persistence is optional for disposable response cache data.

If the same Redis instance also handles queues, durable streams, or locks, do not
use a cache eviction policy that can evict operational data. Prefer separate
instances or explicitly isolated operational design.

## 17. Rollout Plan

Roll out by cache class, not as one large release.

1. Add metrics and headers without enabling Redis caching.
2. Correct service-worker allowlisting and test upgrade/logout behavior.
3. Add Redis client, abstraction, health detail, and fail-open behavior.
4. Enable curve-window caching in development, then UAT.
5. Enable workbench caching for a small UAT cohort or environment.
6. Enable borehole-list caching.
7. Enable AI caching with versioned provider/prompt/settings inputs.
8. Replace process-local realtime with shared pub/sub before scaling API workers.
9. Compare performance and correctness against the Phase 0 baseline after each
   step.

Use feature flags per cache class:

```text
GEOWORKBENCH_CACHE_ENABLED
GEOWORKBENCH_CACHE_CURVE_WINDOWS_ENABLED
GEOWORKBENCH_CACHE_WORKBENCH_ENABLED
GEOWORKBENCH_CACHE_BOREHOLE_LIST_ENABLED
GEOWORKBENCH_CACHE_AI_ENABLED
```

This provides a fast rollback without removing code or flushing unrelated Redis
data.

## 18. Rollback Procedure

If stale, cross-user, or incorrect data is observed:

1. Disable the affected cache-class feature flag.
2. Restart/reload API services using the normal controlled deployment process.
3. Confirm reads now use PostgreSQL/recomputation.
4. Increment the cache schema namespace, for example `v1` to `v2`, rather than
   performing an unsafe broad key deletion.
5. Deploy a service-worker cache revision if browser Cache Storage is involved.
6. Reproduce the issue using the invalidation test matrix.
7. Preserve redacted logs, metrics, affected endpoint, user scope, versions, and
   timestamps for investigation.
8. Re-enable only after automated regression coverage exists.

If unauthorized data crossed user or project boundaries, treat it as a security
incident, not only a performance defect.

## 19. Definition of Done

Caching is considered production-ready only when all of these are true:

- every enabled cache is present in the cache inventory;
- keys include every response-affecting scope and parameter;
- TTLs are explicit and bounded;
- the mutation invalidation matrix is implemented on backend and frontend;
- invalidation occurs after database commit;
- Redis failure falls back without data loss or ordinary request failure;
- multi-instance mutation-to-browser refresh works;
- API, core images, uploads, and exports are absent from service-worker caches;
- authentication responses have `no-store`;
- hashed bundles have immutable long-term caching;
- HTML and service-worker scripts revalidate on deployment;
- logout and user-switch isolation tests pass;
- unit, integration, and browser cache tests pass in CI;
- UAT evidence contains cold/warm timing, hit ratio, invalidation, offline,
  deployment-upgrade, and Redis-outage results;
- dashboards and alerts are active;
- cache-class feature flags provide a tested rollback path.

## 20. Per-Release Checklist

### Code review

- [ ] New reads declare whether and where they are cached.
- [ ] New keys include all response-affecting parameters and access scope.
- [ ] New writes update the invalidation matrix.
- [ ] No secrets or personal data are stored in keys.
- [ ] Tests cover hit, miss, expiry, invalidation, and fallback.

### Build and automated verification

- [ ] Frontend unit tests pass.
- [ ] Frontend production build passes.
- [ ] Backend unit and integration tests pass.
- [ ] Service-worker route tests pass.
- [ ] Multi-user isolation tests pass.
- [ ] Multi-instance realtime test passes where HA is enabled.

### UAT verification

- [ ] Header policies match the route classification.
- [ ] Cold and warm response evidence is captured.
- [ ] Redis TTL and hit/miss evidence is captured.
- [ ] Mutation invalidation is demonstrated.
- [ ] Redis outage fallback is demonstrated.
- [ ] Offline shell works.
- [ ] Protected data is absent from Cache Storage.
- [ ] Service-worker upgrade loads the current release.
- [ ] Logout and user switching leave no prior query data.

### Production verification

- [ ] Cache feature flags match the approved rollout stage.
- [ ] Redis is private, monitored, and memory-limited.
- [ ] Error, fallback, hit-ratio, and latency dashboards are healthy.
- [ ] No unexpected cache-related 401, 403, or 5xx behavior appears.
- [ ] The rollback path and responsible operator are recorded.
