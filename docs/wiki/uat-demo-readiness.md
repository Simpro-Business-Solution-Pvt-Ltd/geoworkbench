# GeoWorkbench UAT Demo Readiness

Updated: 2026-07-04

This note maps the UAT/explore backlog to the current demo build. It is intended for stakeholder walkthroughs where we need to show visible progress while keeping deeper production work explicit.

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
| #22 Profile/preferences/theme | Web profile menu, persisted light/dark theme, logout, health card | User preference persistence is local browser storage, not yet DB-backed |
| #23 UI polish | Operational shell, profile surface, consistent login and mobile styling | Broader Horilla/SimproHRMS-inspired polish can continue view by view |
| #24 Import/export happy path | Import Center and Export Center expose template, process/merge, readiness review, export settings, and export artifact steps | UAT should verify one Excel and one LAS/PDF path on the server dataset; Minex format needs customer template confirmation |
| #25 Correlation narrative | Correlation view shows multi-borehole selection, depth/RL alignment, seam/curve comparison, AI insight popup | Competitive interpretation rules need stakeholder validation |
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
```

The frontend profile menu uses the diagnostics endpoint and refreshes it while open.
