# GeoWorkbench UAT Demo Readiness

Updated: 2026-08-21

This note maps the UAT/explore backlog to the current demo build. It is intended for stakeholder walkthroughs where we need to show visible progress while keeping deeper production work explicit.

For the demo narrative and manual test path, use [Reliance UAT Story And Demo Script](user-manual/reliance-uat-story-and-demo-script.md) as the primary guide.

For the current product/refinement milestone tracker, use [UAT Interpretation Platform Plan](user-manual/uat-interpretation-platform-plan.md).

## UAT Disclaimer

This build is a working UAT preview for guided evaluation. It is intended to help stakeholders experience the application flow and suggest refinements. The UI/UX, template editor ergonomics, merge review screens, and customer-specific export formats are not final production design.

Import/export should be tested as a capability workflow:

- Import is a data-integrity flow: upload/register, detect template, preview mapping, validate, confirm merge, audit.
- Export is a permission-controlled data handover flow: choose scope/template, review readiness, generate, download.
- Export readiness is advisory unless validation errors exist. It is not a second-user approval workflow in this UAT build.

## Demo Credentials

| User | Password | Role | Intended demo use |
| --- | --- | --- | --- |
| `geologist` | `geologist123` | Central Geologist | Web workbench, import/export, AI review, approval discussion |
| `field` | `field123` | Site Geologist | Mobile OTP flow and field data sync |

Mobile uses `/api/auth/mobile/request-otp` and `/api/auth/mobile/verify-otp`. If push notifications are disabled, the backend returns a dev OTP for UAT.

## Backlog Coverage

| Issue | Demo-ready slice | Known production gap |
| --- | --- | --- |
| #20 Web IAM | DB-backed demo users, local login, bearer session, `/auth/me`, `/auth/logout`, profile role display | Full per-route RBAC and Microsoft Entra ID JWT validation remain staged |
| #21 Mobile auth | Flutter OTP request/verify path, backend-issued token, identity shown in field header | Secure token storage, offline refresh, push provider setup, and strict mobile API authorization remain staged |
| #22 Profile/preferences/theme | Web profile menu, persisted light/dark theme, logout, health card, server-backed unit/timezone preferences and last workspace context | Project/role default preference policies remain staged |
| #23 UI polish | Operational shell, profile surface, consistent login and mobile styling | Broader Horilla/SimproHRMS-inspired polish can continue view by view |
| #24 Import/export happy path | Import Center and Export Center expose template, process/merge, readiness review, import audit facts, export settings, and export artifact audit facts | UAT should verify one Excel and one LAS/PDF path on the server dataset; Minex format needs customer template confirmation |
| #25 Correlation narrative | Correlation view shows multi-borehole selection, depth/RL alignment, seam/curve comparison, AI insight popup, and database-backed geologist observation notes | Competitive interpretation rules need stakeholder validation |
| #26 Observability | `/health`, `/api/diagnostics/health`, request timing header, DB/AI/upload/export diagnostics | OpenTelemetry exporter and dashboard wiring are documented but deferred |
| #27 Deployment evidence | Existing deployment docs cover Linux/Nginx, Windows/IIS, local Postgres; this file captures demo evidence | Final server URL, secrets, backup/rollback evidence to be filled during deployment |
| #28 Architecture guide | Existing wiki architecture docs cover backend, frontend, workflows, geophysical import, and interaction model | Add auth/observability extension diagrams after UAT feedback |

## Demo Flow

1. Sign in on web as `geologist`.
2. Show the profile menu: role, theme switch, diagnostics.
3. Open Dashboard and select a borehole/display.
4. Show Workbench: lithology/curves/core image track, AI markers, interval edit popup.
5. Open Import Center: show template mapping, source queue, process/merge actions, and explain merge as the data-integrity control point.
6. Open Export Center: show readiness review, export format/settings, generated artifact evidence, and explain export as permission-controlled without second-user approval in this UAT build.
7. Open Correlation: selected boreholes, depth/RL explanation, insight popup, geologist decision points.
8. Switch to mobile: request OTP for `field`, verify, show field user role, submit/capture/upload flow.

## Health Checks

Use these before the demo:

```powershell
Invoke-RestMethod http://127.0.0.1:8081/health
Invoke-RestMethod http://127.0.0.1:8081/api/diagnostics/health
.\scripts\uat-smoke.ps1 -BaseUrl http://127.0.0.1:8081
```

The smoke script prefers a `RELIANCE-COAL` borehole when one is present. It verifies health, diagnostics, login, current session, borehole/workbench data, import profiles, source-file audit route, export profiles, export readiness, AI summary evidence, and correlation observation route availability. Use `-PreferredProjectCode` to target another project during local/demo-data checks.

The frontend profile menu uses the diagnostics endpoint and refreshes it while open.

## Deployment Evidence Checklist

Capture this evidence after every customer-server deployment or refresh:

| Area | Evidence to capture | Command or screen |
| --- | --- | --- |
| Git revision | Branch and commit deployed | `git status --short --branch`; `git rev-parse HEAD` |
| Backend health | API process responds | `Invoke-RestMethod https://geowb.simproapps.in/health` |
| Diagnostics | Database, AI config, upload/export paths | `Invoke-RestMethod https://geowb.simproapps.in/api/diagnostics/health` |
| UAT smoke | End-to-end API happy path | `.\scripts\uat-smoke.ps1 -BaseUrl https://geowb.simproapps.in` |
| PostgreSQL | Database name, host, backup job, migration status | `alembic current`; DBA backup evidence |
| AI endpoint | Local LM Studio or configured provider is reachable from server | Profile diagnostics and AI summary screen |
| Import | One Excel or LAS source can be uploaded, parsed, merged, and audited | Import Center source queue and parsed imports |
| Export | One corrected Excel/CSV or LAS export can be generated and downloaded | Export Center readiness and history |
| Correlation | Observation note is saved and visible after refresh | Correlation insight dialog |
| Reverse proxy | HTTPS binding, `/api`, `/health`, and static frontend routes work | Browser plus IIS/Nginx route config screenshot |
| Storage | Upload and export directories or object bucket are durable | Server path/bucket listing and backup plan |

## Tomorrow UAT Smoke Checklist

Run this in one pass after deployment or after pulling the latest feature branch:

1. Sign in as `geologist`.
2. Change unit/timezone preferences, refresh the browser, and confirm they persist.
3. Select a Reliance borehole and saved/default display, refresh, and confirm the same context reloads.
4. Open Workbench and confirm the runtime display renders KPI widgets, log widget, interval details, validation, AI workflow, and curve catalog.
5. In Display setup, clone the saved display, confirm the top-bar display selector can switch to the clone, then add a single-value widget and choose **Curve coverage %** or curve coverage depth range.
6. Open log widget settings, add/reorder tracks, reorder curves, reset a curve scale, and save the display.
7. Delete the cloned display and confirm the original display remains available.
8. Open the curve catalog and confirm LAS curves show mnemonic, family, mapping status, coverage, sample count, and min/max.
9. Run validation and confirm depth-linked issues still move the selected depth.
10. Open Import and confirm template/profile lists load, source audit facts are visible, and parsed imports show adapter/template/row evidence.
11. Open Export and confirm template/profile lists load, readiness checks render, and export history shows audit facts.
12. Open Correlation, save a geologist note from the AI insights dialog, refresh, and confirm the note is still visible.
13. Open Wiki and confirm user docs are visible, with developer architecture docs visible only for developer/admin users.
