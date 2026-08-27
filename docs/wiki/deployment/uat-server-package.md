# Reliance UAT Server Package

This note describes how to deploy a GeoWorkbench UAT package to a Windows Server with IIS in front of FastAPI.

## Package Contents

The deployment zip is prepared with:

- `backend/` - FastAPI application, Alembic migrations, backend scripts, and backend dependency metadata.
- `frontend-dist/` - production Vite build to serve from IIS.
- `scripts/uat-smoke.ps1` - post-deployment smoke test.
- `docs/` - user, UAT, architecture, and deployment wiki.
- `mobile/app-debug.apk` - Android UAT build for field workflow testing, when available.
- `DEPLOYMENT-INSTRUCTIONS.md` - package-local copy of these steps.

The package intentionally excludes:

- `.git`
- Python virtual environments
- `node_modules`
- local build caches
- local database files
- runtime upload/export data
- Reliance source datasets

Keep customer data as a separate controlled package and import it into the server database after the application is deployed.

## Server Prerequisites

- Windows Server with IIS.
- IIS URL Rewrite and Application Request Routing.
- Python 3.11 or newer.
- PostgreSQL reachable from the app server.
- Node.js is not required on the server if `frontend-dist/` is already built.
- NSSM or another Windows Service wrapper for FastAPI.
- Optional: LM Studio or another OpenAI-compatible local model endpoint for AI summaries.

## Suggested Server Paths

```text
D:\GeoWorkbench\releases\geoworkbench-uat-<commit>
D:\GeoWorkbench\current
D:\GeoWorkbench\data\uploads
D:\GeoWorkbench\data\exports
D:\GeoWorkbench\data\reliance
D:\GeoWorkbench\logs
```

`current` can be a copy of the active release folder, or a junction managed during release refreshes.

## Backend Environment

Create `D:\GeoWorkbench\current\backend\.env` on the server. Do not commit this file.

```powershell
GEOWORKBENCH_DATABASE_URL=postgresql+psycopg://postgres:<password>@<db-host>:5432/geoworkbench_uat
GEOWORKBENCH_UPLOAD_ROOT=D:\GeoWorkbench\data\uploads
GEOWORKBENCH_EXPORT_ROOT=D:\GeoWorkbench\data\exports
GEOWORKBENCH_CORS_ORIGINS=["https://geowb.simproapps.in","http://localhost:5173"]
GEOWORKBENCH_WEB_BASE_URL=https://geowb.simproapps.in

GEOWORKBENCH_AI_PROVIDER=local_openai
GEOWORKBENCH_AI_BASE_URL=http://<local-ai-host>:1234/v1
GEOWORKBENCH_AI_MODEL=google/gemma-4-12b-qat
GEOWORKBENCH_AI_TIMEOUT_SECONDS=90

GEOWORKBENCH_ENTRA_TENANT_ID=<tenant-id>
GEOWORKBENCH_ENTRA_CLIENT_ID=<client-id>
GEOWORKBENCH_ENTRA_CLIENT_SECRET=<client-secret>
GEOWORKBENCH_ENTRA_REDIRECT_URI=https://geowb.simproapps.in/api/auth/entra/callback
GEOWORKBENCH_ENTRA_DEFAULT_ROLE=central_geologist

GEOWORKBENCH_PUSH_PROVIDER=disabled
```

For the first UAT server, local file storage is acceptable if `UPLOAD_ROOT` and `EXPORT_ROOT` are durable and backed up. Object storage can be added later.

## Deploy Or Refresh

1. Stop the existing FastAPI service.

```powershell
Stop-Service GeoWorkbenchApi
```

2. Extract the package to a new release folder.

```powershell
Expand-Archive .\geoworkbench-uat-<commit>.zip D:\GeoWorkbench\releases\geoworkbench-uat-<commit>
```

3. Copy or create the server `.env`.

```powershell
Copy-Item D:\GeoWorkbench\current\backend\.env D:\GeoWorkbench\releases\geoworkbench-uat-<commit>\backend\.env
```

4. Point `current` to the new release. If not using junctions, copy the extracted release to `D:\GeoWorkbench\current`.

```powershell
Remove-Item D:\GeoWorkbench\current -Force
New-Item -ItemType Junction -Path D:\GeoWorkbench\current -Target D:\GeoWorkbench\releases\geoworkbench-uat-<commit>
```

5. Create/update Python virtual environment and install backend dependencies.

```powershell
cd D:\GeoWorkbench\current\backend
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e .
```

6. Run migrations.

```powershell
alembic upgrade head
```

7. Configure IIS site root to:

```text
D:\GeoWorkbench\current\frontend-dist
```

8. Configure IIS reverse proxy:

```text
/api/*   -> http://127.0.0.1:8081/api/*
/health  -> http://127.0.0.1:8081/health
/assets/* -> http://127.0.0.1:8081/assets/*
```

9. Start the FastAPI service.

```powershell
Start-Service GeoWorkbenchApi
```

If creating the service for the first time with NSSM, use:

```text
Path: D:\GeoWorkbench\current\backend\.venv\Scripts\python.exe
Arguments: -m uvicorn app.main:app --host 127.0.0.1 --port 8081
Startup directory: D:\GeoWorkbench\current\backend
```

## Import Reliance Data

Before importing Reliance data into an existing UAT database, remove old demo/test geology data.
This keeps PBH/CTSJ/SPNG/synthetic boreholes out of the customer review environment while preserving users, roles, import templates, export templates, and settings.

Preview the cleanup first:

```powershell
cd D:\GeoWorkbench\current\backend
.\.venv\Scripts\Activate.ps1
python scripts\cleanup_uat_data.py
```

Apply the cleanup:

```powershell
python scripts\cleanup_uat_data.py --apply
```

Default cleanup targets:

- `DEMO-COAL`
- `DEMO-COAL-BLOCK`
- `RAHAM-COAL`
- standalone boreholes starting with `PBH-`, `CTSJ-`, `IMPORT-DEMO-`, or `SPNG-`

It does not delete local users or Entra-created users.

Copy the customer data package to:

```text
D:\GeoWorkbench\data\reliance
```

If the original zips are used, extract them so the folders match:

```text
D:\GeoWorkbench\data\reliance\Data_10BH\Data_10BH
D:\GeoWorkbench\data\reliance\LAS\LAS
```

Then run:

```powershell
cd D:\GeoWorkbench\current\backend
.\.venv\Scripts\Activate.ps1
python scripts\import_reliance_data.py `
  --data-root D:\GeoWorkbench\data\reliance\Data_10BH\Data_10BH `
  --las-root D:\GeoWorkbench\data\reliance\LAS\LAS
```

This path imports through the backend model and keeps the server database independent from local developer backups.

## Verify

Run from the repository/package root:

```powershell
.\scripts\uat-smoke.ps1 -BaseUrl https://geowb.simproapps.in -RequireAi
```

Minimum manual checks:

- Open the web URL.
- Login with a local user or Entra ID.
- Confirm Reliance boreholes are listed.
- Open dashboard map and switch basemaps.
- Open workbench for one borehole.
- Open import/export centers.
- Open correlation.
- Open Wiki and UAT Test Cases.
- Install/open the PWA on a mobile browser.
- Install the Android APK for field workflow testing.

## Rollback

Keep the previous release folder until smoke testing passes.

To roll back:

```powershell
Stop-Service GeoWorkbenchApi
Remove-Item D:\GeoWorkbench\current -Force
New-Item -ItemType Junction -Path D:\GeoWorkbench\current -Target D:\GeoWorkbench\releases\<previous-release>
Start-Service GeoWorkbenchApi
```

Database rollback is not automatic. Take a PostgreSQL backup before migrations and before bulk Reliance imports.
