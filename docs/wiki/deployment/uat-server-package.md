# Reliance UAT Server Update

These instructions update the existing Windows Server deployment: WinSW service
`GeoWorkbenchApi`, backend on `127.0.0.1:8081`, IIS files in
`C:\inetpub\geoworkbench`, and external PostgreSQL. Run server commands in
Administrator PowerShell. Node.js and Docker are not required on this server.

## What This Release Updates

- Import template creation, mapping, sample testing, versioning and archiving.
- Import into the selected borehole; template snapshot retained from preview to merge.
- Correlation zoom and seam top/bottom matching across grouped seam bands.
- Log widget zoom scroll positioning and windowed curve loading.
- Field PWA interval validation, RQD percentage conversion, offline interval outbox,
  and uploaded-file history.
- Recovery percentage retained when mapped through a registry template.

This update uses the existing database, users, boreholes, layouts and uploaded
files. The merged changes add no Alembic migration. Do not run data cleanup,
database restore, or bulk import as part of this application update.

## Package Contents

- `backend/`: committed backend source and dependencies in `pyproject.toml`.
- `frontend-dist/`: built web app and field PWA, icons, manifest, service worker, and IIS config.
- `scripts/deploy-windows-release.ps1`: update the existing service and IIS files.
- `scripts/rollback-windows-release.ps1`: restore the previous service and frontend.
- `scripts/uat-smoke.ps1`: authenticated API and optional IIS/PWA checks.
- `docs/`: application wiki.
- `RELEASE.json`: branch, exact source commit and build date.
- `FILE-HASHES.json`: SHA-256 hashes of release files.

The zip excludes server secrets, Python environments, database backups, customer
datasets, runtime uploads/exports and release packages. Android APKs are included
only when explicitly requested during packaging. The field PWA is included by default.

## 1. Extract Into a New Folder

Keep the running release. Extract the supplied zip into a **new** folder below
`C:\GeoWorkbench\release`; existing older folders under `releases` can stay where
they are. Use the actual zip filename in these commands:

```powershell
$zip = 'C:\GeoWorkbench\geoworkbench-uat-<release-name>.zip'
$release = Join-Path 'C:\GeoWorkbench\release' ([IO.Path]::GetFileNameWithoutExtension($zip))
if (Test-Path -LiteralPath $release) { throw 'Choose a new release folder.' }
Expand-Archive -LiteralPath $zip -DestinationPath $release
Get-Content -LiteralPath (Join-Path $release 'RELEASE.json')
```

The extracted folder should contain `backend`, `frontend-dist`, and `scripts`
directly. Do not copy or move an old `.venv`: create a new one for the new backend.

## 2. Check the Paths Before Updating

```powershell
& (Join-Path $release 'scripts\deploy-windows-release.ps1') `
  -ReleasePath $release -CheckOnly
```

This reads `C:\GeoWorkbench\service\GeoWorkbenchApi.xml`, checks the package's
frontend assets and PWA manifest, and identifies the existing backend and `.env`.
It changes nothing. The script supports paths containing spaces.

It uses `.env` already in the new release, if present. Otherwise it copies `.env`
from the current service's backend. If your environment is stored elsewhere,
pass `-EnvSource 'C:\path\to\server.env'`.

The existing `.env` must retain the PostgreSQL URL, durable upload/export paths,
Entra configuration and server AI endpoint. Do not replace it with a developer
environment. The database and uploaded files should already have their normal backups.

## 3. Apply the Update

Redis is not installed on the current server, so use `-DisableRedis`:

```powershell
& (Join-Path $release 'scripts\deploy-windows-release.ps1') `
  -ReleasePath $release -DisableRedis
```

The script:

1. Copies the current server `.env` into the new release if necessary.
2. Creates a Python 3.11 `.venv` and installs the backend dependencies.
3. Disables Redis caching and Redis realtime distribution in the new `.env`.
4. Checks the PostgreSQL connection before stopping the current service.
5. Backs up the existing WinSW XML and IIS frontend into
   `C:\GeoWorkbench\deployment-backups\<timestamp>-<commit>`.
6. Stops `GeoWorkbenchApi` and confirms port 8081 has been released.
7. Updates the existing WinSW XML executable, working directory and Uvicorn arguments.
8. Starts the service and checks API/database health.
9. Copies the built frontend to `C:\inetpub\geoworkbench`, publishing `index.html` last.

The script preserves existing WinSW settings and the existing IIS `web.config`.
It also retains the effective old data roots when they were not explicitly set
in `.env`, because older source-file/export records can use relative paths.
Keep the old data root available; this update does not move stored files.
Old hashed JS/CSS files remain available for already-open browser tabs. If backend
health or file copying fails, it attempts to restore the previous service config
and frontend. No database migrations or data imports are performed.

If IIS configuration needs replacement, use `-ReplaceIisConfig` explicitly. The
packaged `web.config` contains SPA fallback, API/health/corebox proxy rules, MIME
types and cache headers. Existing IIS URL Rewrite and ARR must remain installed.

Python 3.11 must be available through `py -3.11`; pip needs access to your package
index. If port 8081 is still occupied, the script reports its PID and stops; it
does not kill a manually running backend process.

## 4. Verify the Server

Use an existing authorized local account. These commands prompt for its password
and check existing data; they do not create boreholes or change interpretations.

```powershell
Get-Service GeoWorkbenchApi
Get-Content 'C:\GeoWorkbench\service\GeoWorkbenchApi.xml'

& (Join-Path $release 'scripts\uat-smoke.ps1') `
  -BaseUrl 'http://127.0.0.1:8081' -Username 'geologist'

& (Join-Path $release 'scripts\uat-smoke.ps1') `
  -BaseUrl 'https://geowb.simproapps.in' -Username 'geologist' -CheckFrontend
```

The direct API check confirms the new realtime, preferences and template-test
routes exist. Both checks verify login, current user, boreholes, workbench,
import/export templates, export readiness, AI summary and correlation observations.
The public-site check also verifies the web/PWA HTML, referenced production assets,
manifest, icons and service worker. Add `-RequireAi` if model availability must pass.

If the API passes directly but the public check fails, inspect the IIS proxy or
static-file configuration. If the API routes are missing directly, verify the
service XML points to the newly extracted backend.

Backend logs follow the log configuration in the existing WinSW XML, usually in
`C:\GeoWorkbench\service` or its configured log folder. A failed service start
should be diagnosed there before trying another backend instance on port 8081.

## Web and Field PWA Addresses

- Central web application: `https://geowb.simproapps.in/`
- Field capture PWA: `https://geowb.simproapps.in/field`
- Install manifest: `https://geowb.simproapps.in/manifest.webmanifest`

The deployed field URL is `/field`. On iPhone, open it in Safari and select
Share > Add to Home Screen. It provides borehole creation/selection, interval and
operational parameter capture, photos and file uploads. Offline intervals are
stored on the device; file uploads require the app to stay open and a connection.

Refresh existing browser tabs after deployment. If a device still shows the old
build, reload with cache disabled or reopen the installed PWA while online.

Automated checks do not replace visual UAT for drag zoom, correlation layout,
display editing or device camera behavior. Those remain to be verified on the server.

## Rollback

Keep the previous release and the backup folder printed during deployment.
Use that exact backup path:

```powershell
& (Join-Path $release 'scripts\rollback-windows-release.ps1') `
  -BackupPath 'C:\GeoWorkbench\deployment-backups\<printed-backup-folder>'
```

This restores the service XML and frontend, and restarts the previous backend.
The database and uploaded files are retained. It does not reverse user edits made
after the update. Run the server smoke check again after rollback.

## Rebuilding the Package

From a clean, committed developer checkout:

```powershell
& 'D:\Source\geoworkbench\scripts\package-uat.ps1'
```

The script builds the frontend, archives committed source, writes release metadata
and file hashes, and creates the zip under `release-packages`. That folder is ignored
by Git. Run the frontend/backend tests before handing over a new release.
