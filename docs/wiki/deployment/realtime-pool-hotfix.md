# Realtime Database Pool Hotfix

Prepared 19 November 2026 for the reported login HTTP 500 and degraded diagnostics:
`QueuePool limit of size 5 overflow 10 reached ... timeout 30.00`.

## Diagnosis and Recovery

The API is running. The message reports SQLAlchemy application-pool exhaustion,
not proof that PostgreSQL itself is stopped or that its global connection limit
has been reached. Login and diagnostics need an available database connection.

The realtime SSE endpoint previously authenticated through the request-scoped
database dependency. That authentication query left a transaction/connection open
until the long-lived streaming response ended. Enough open workbench streams can
consume the default 5 pooled plus 10 overflow connections. This leak was reproduced
locally. Other slow or blocked requests could also consume connections; check
database activity if the server still degrades after this fix.

For immediate temporary recovery, close workbench/PWA tabs, restart only the API
service, then check diagnostics:

```powershell
Restart-Service GeoWorkbenchApi
Invoke-RestMethod 'http://127.0.0.1:8081/api/diagnostics/health'
```

Do not use a larger pool as the sole fix for this leak. Redis/GPU/model changes are
not required by this hotfix. PostgreSQL and IIS do not need to be restarted.

## Change

`backend/app/domains/realtime/router.py` now uses a short-lived session in a
synchronous authentication dependency. It validates the token, allows the existing
session-refresh logic to run, and releases the database connection before starting
the event stream. SSE messages and client URLs remain the same. This does not add
continuous authentication/revocation checks during an already-open stream.

Regression tests open 20 ASGI event streams against a one-connection SQLAlchemy
pool, verify an ordinary query remains possible, verify update delivery, close the
streams, and check cleanup. Invalid tokens remain rejected without subscriptions
or held connections. Tests use SQLite for pool-lifetime isolation; deployed
PostgreSQL/proxy behavior must still be checked on the server.

## Apply the Backend-Only ZIP

Place the hotfix zip in `C:\GeoWorkbench`, then run Administrator PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
$zip = 'C:\GeoWorkbench\geoworkbench-realtime-pool-hotfix-<commit>.zip'
$folder = Join-Path 'C:\GeoWorkbench\hotfixes' ([IO.Path]::GetFileNameWithoutExtension($zip))
Expand-Archive -LiteralPath $zip -DestinationPath $folder
& (Join-Path $folder 'scripts\apply-realtime-pool-hotfix.ps1')
```

The script discovers the active backend from the existing WinSW XML at
`C:\GeoWorkbench\service\GeoWorkbenchApi.xml`. It verifies both original and patch
hashes, checks Python syntax, backs up the original router beside it, stops the
service, replaces this one file, starts the service and checks database health.
An unrecognized original file is not overwritten. If startup/health fails, the
script attempts to restore the original router and restart the API.

No virtual environment, dependency installation, frontend rebuild, `.env` change,
schema migration, data cleanup, or customer-data replacement is needed. The active
release's `RELEASE.json` still describes its base release; `HOTFIX.json` identifies
the patch commit and hashes for the deployment record.

## Verify

1. Diagnostics reports `database.status = ok` and login works.
2. Open several workbench tabs, leave them connected, and repeat diagnostics.
3. Edit a test interval or submit a test field observation; confirm realtime
   refresh still reaches another open workbench.
4. Repeated open/close/reconnect cycles must not cause growing connection usage.
5. If exhaustion recurs, inspect API traces and PostgreSQL `pg_stat_activity` for
   long-running statements or idle transactions. Do not terminate database
   sessions indiscriminately.

Developer references: `backend/tests/test_realtime_session_lifetime.py` and
`backend/tests/test_realtime_broker.py`.
