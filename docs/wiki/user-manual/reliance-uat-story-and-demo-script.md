# Reliance UAT Story And Demo Script

Updated: 2026-08-24

This is the canonical story for the current GeoWorkbench UAT build. Use it for stakeholder demos, partner testing, and internal walkthroughs. Older planning documents are still useful as background, but this page is the main narrative for what the application is trying to prove now.

For milestone tracking around data meaning, corrected interpretation, correlation value, and the configurable widget/display platform, use [UAT Interpretation Platform Plan](uat-interpretation-platform-plan.md).

## Product Story

GeoWorkbench is a central geology workspace for coal borehole correction and interpretation. The application is designed around a practical problem: field data, Excel lithology sheets, LAS/geophysical curves, corebox images, remarks, corrections, and exports often move through disconnected files and manual review steps.

The value proposition is simple:

- Bring site and central geology data into one auditable model.
- Show lithology, curves, seams, recovery/RQD, remarks, AI/rule findings, and source evidence together.
- Let the central geologist review, override, save, and explain decisions.
- Keep every source file, merge step, edit, and export traceable.
- Prepare corrected data for downstream modelling/planning tools.

This is not positioned as an AI system that replaces geologists. It is a geology productivity system where AI, rules, analytics, and visualization prepare evidence and suggestions while the geologist remains responsible for interpretation.

## Current UAT Narrative

The current build demonstrates an end-to-end workflow:

1. **Identity and preferences**
   Users sign in through local users or Entra ID where configured. The profile menu shows role, theme, preferences, and diagnostics.

2. **Borehole selection**
   The dashboard lets the user select a borehole and display. The selected context is persisted so the user can refresh and return to the same work.

3. **Central review workspace**
   The workbench shows configurable widgets. Evidence Coverage gives a quick map of available/missing data. The log widget brings together depth, lithology, curves, seams, RQD/recovery, AI markers, remarks, and core image state. The interval panel shows metadata, provenance, source data, correction history, and editable interval fields.

4. **Import and merge**
   Import Center accepts uploaded or registered source files. It exposes templates, mapping preview, process/merge actions, and source audit facts such as adapter, template, row count, curves, depth range, file size, and merge mode.

5. **Rules, AI insights, and interpretation queue**
   Validation, AI summary, and the interpretation queue highlight quality issues, correction progress, missing evidence, source coverage, curve availability, and geological review points. The current UAT build uses deterministic rules plus local/OpenAI-compatible model summarization where configured.

6. **Correlation**
   Correlation view compares multiple boreholes by lithology, seam markers, gamma/geophysical response, and depth/RL alignment. The AI insights dialog generates review points and lets the geologist save database-backed observations directly from an insight or through a free-form interpretation note.

7. **Export**
   Export Center shows readiness checks, lets the user choose export settings, generates Excel/CSV/LAS outputs, and displays export audit facts. Export is permission-controlled in this UAT build, not a full second-user approval workflow.

8. **Mobile field capture**
   The mobile app supports field sign-in, borehole/source-file upload, corebox/photo capture path, interval-style inputs, and runtime parameter capture. The backend treats mobile as another data-arrival channel.

9. **Deployment and evidence**
   The wiki, health endpoint, diagnostics endpoint, and smoke script provide a repeatable way to prove the deployment is alive and ready for UAT.

## What Reliance Should See

The demo should make these points clear:

| Stakeholder concern | What to show | Business value |
| --- | --- | --- |
| Data arrives from many places | Evidence Coverage, mobile capture, Excel/LAS upload, source queue, parsed imports | Reduces scattered file handling and re-entry |
| Templates change | Template registry and source-to-model/source-to-output mapping preview | Gives a controlled path for multiple Excel/LAS formats |
| Corrections need traceability | Interpretation queue, interval edit, data stage, source metadata, correction history | Makes decisions reviewable later |
| Geophysical logs must support interpretation | Curve tracks, curve catalog, curve coverage, AI summary evidence | Helps compare lithology against measured log response |
| Corebox images are important | Core image state, linked image design, current missing-package state | Keeps visual evidence in the same interpretation context |
| Correlation is critical | Multi-borehole correlation, seam continuity, depth/RL mode, saved notes | Helps review seam continuity and missing/inconsistent markers |
| Exports must feed other tools | Export settings, readiness, generated Excel/CSV/LAS, export audit | Reduces manual reshaping before downstream modelling |
| Customer needs a deployable system | Health, diagnostics, smoke script, deployment wiki | Supports controlled server evaluation |

## Demo Setup

Before the walkthrough:

1. Confirm backend and frontend are running.
2. Run the smoke script against the demo URL:

```powershell
.\scripts\uat-smoke.ps1 -BaseUrl http://127.0.0.1:8081
```

For the AI-enabled server demo, run:

```powershell
.\scripts\uat-smoke.ps1 -BaseUrl https://geowb.simproapps.in -RequireAi
```

3. Confirm at least one Reliance borehole is available.
4. Confirm local AI provider status if AI narrative is part of the demo.
5. Keep this page open in the Wiki view as the demo guide.

## Demo Script

### 1. Sign In And Profile

Say:

> We start with a role-based geology workspace. This can work with local users for UAT and Entra ID for enterprise deployment.

Do:

- Sign in as `geologist`.
- Open the profile menu.
- Show role, theme, preferences, diagnostics.

Test:

- Refresh after changing theme or preference.
- Confirm the application remains signed in and preferences are preserved.

### 2. Dashboard And Borehole Context

Say:

> The first screen is not the interpretation tool itself. It is the starting point to choose the borehole, display, and future project-level settings.

Do:

- Select a Reliance borehole.
- Select the default or saved display.
- Open the workbench.

Test:

- Refresh the page.
- Confirm the selected borehole/display context is restored.

### 3. Workbench Visualization

Say:

> This is the central geologist's working display. It combines intervals, curves, seams, recovery/RQD, remarks, AI findings, and source evidence in one depth-based workspace.

Do:

- Show lithology, curve, seam/RQD/recovery, AI, and core image state tracks where configured.
- Show Evidence Coverage and explain which evidence is available, partial, or missing for the borehole.
- Show the interpretation queue and explain raw/imported, partially corrected, and ready-for-review states.
- Click a depth/lithology interval.
- Show interval metadata, source evidence, and correction history.
- Open an interval edit panel, change a harmless comment/remark if testing allows, and save.

Test:

- Click several depths and confirm the metadata panel follows the selected depth.
- Confirm source/stage metadata remains visible.
- Confirm saved edits create correction history.

### 4. Rules And AI Review

Say:

> AI is used as an assistant. Rules produce deterministic findings, and the model can summarize evidence. The geologist accepts, rejects, or manually applies interpretation changes.

Do:

- Run validation if needed.
- Generate AI suggestions or open AI summary.
- Show evidence and recommended action.

Test:

- Confirm validation issues are visible.
- Confirm AI summary includes source/curve/evidence context.
- Confirm accept/reject behavior is understandable, even if final governance will be refined.

### 5. Import Center

Say:

> Import is treated as a data-integrity workflow, not just a file upload. The source file remains linked, template detection/mapping is visible, merge mode is explicit, and audit facts remain on screen.

Do:

- Open Import Center.
- Show template registry.
- Click a template to show mapping.
- Show source queue and parsed import batches.
- Process or merge a prepared test file only if this is a safe test dataset.

Test:

- Confirm Excel/LAS templates load.
- Confirm source audit chips show parser/template/rows/curves/depth where available.
- Confirm merge choices are understandable.

### 6. Correlation View

Say:

> Correlation helps geologists compare multiple boreholes, seam continuity, depth/RL alignment, lithology, and geophysical response. The saved observation becomes part of the review record for that selected borehole set.

Do:

- Open Correlation.
- Switch between synthetic/demo and received data sets if both are available.
- Show depth/RL toggle.
- Open AI insights.
- Point out the recommended action attached to each insight.
- Save an insight as a correlation observation, then draft/save a manual correlation note.
- Close, refresh, reopen, and show the note persists with author and timestamp.

Test:

- Confirm selected boreholes are clear.
- Confirm notes persist after refresh.
- Confirm the story around RL is clear: RL alignment depends on reliable collar RL/elevation metadata.

### 7. Export Center

Say:

> Export is the controlled handover step. The UAT build supports corrected lithology Excel/CSV and curve LAS/CSV. Customer-specific Minex or other templates should be finalized after Reliance confirms exact import requirements.

Do:

- Open Export Center.
- Show export template/profile.
- Show readiness checks.
- Generate a safe export.
- Show export history and audit facts.
- Download the output.

Test:

- Confirm at least one Excel/CSV export works.
- Confirm LAS export works when curves exist.
- Confirm export history shows rows/curves/stage/depth/readiness facts.

### 8. Mobile App

Say:

> Mobile is the field data-arrival channel. It can support interval forms, runtime parameters, source files, and corebox/photo capture.

Do:

- Sign in on mobile.
- Show interval/runtime parameter form.
- Upload or capture a source/photo if the emulator/device is ready.
- Show backend/web can associate uploaded data with a borehole.

Test:

- Confirm mobile login works.
- Confirm upload status is visible.
- Confirm backend receives the source file or field submission.

### 9. Wiki, Health, And Deployment Evidence

Say:

> The UAT deployment is meant to be testable. The application includes user documentation, developer documentation for authorized users, health checks, diagnostics, and a smoke script.

Do:

- Open Wiki.
- Show this page and UAT readiness.
- Show diagnostics from profile menu or `/api/diagnostics/health`.

Test:

- Run `scripts/uat-smoke.ps1`.
- Capture health/diagnostics output for deployment evidence.

## Current Known Limits To Explain

Keep the explanation short and confident:

- Reliance data received so far may not include aligned Excel, LAS, and corebox images for the same boreholes.
- Corebox image depth-track extraction needs Reliance corebox image packages and confirmed depth/lane rules before production use.
- Customer-specific Minex export depends on the exact target template/import requirements.
- Full route-level RBAC, maker-checker approval, notifications, and digital signoff are staged for production refinement.
- Advanced log-widget interaction and large-data performance will continue to be hardened with focused testing.

## Future Use Cases

The future roadmap should be framed as extensions of the same data model and workspace:

| Future capability | What it adds | Why it matters |
| --- | --- | --- |
| Advanced template designer | UI-based import/export field mapping, validation rules, preview rows | Lets Reliance onboard new workbook/log formats without code changes |
| Versioned correction stages | Raw, imported, AI-suggested, geologist-corrected, approved versions | Makes correction history and comparison formal |
| Maker-checker approval | Review queue, notifications, approval comments, export gates | Supports governance for final corrected logs |
| Corebox image processing | Tray/lane extraction, scale detection, depth mapping, image tiles | Brings visual rock evidence into the log display reliably |
| Geophysical interpretation rules | Curve/lithology conflict checks, seam response checks, washout/caliper flags | Turns curves into actionable review prompts |
| Correlation workbench | Marker picking, seam aliases, confidence, distance/RL-aware panels | Moves beyond visual comparison into geological decision support |
| Predictive analytics | Missing seam risk, thickness trends, quality risk scoring | Useful after enough labelled historical data is available |
| Enterprise storage | Object storage, backups, retention, audit reports | Makes uploads/images/exports durable and scalable |
| Downstream integration | Minex/Surpac/customer templates, APIs, scheduled packages | Reduces manual reshaping and handover errors |

## Manual Testing Checklist

Use this as the compact pass/fail checklist:

| Area | Pass condition |
| --- | --- |
| Login | Local login works; Entra works if configured |
| Preferences | Theme/unit/timezone/context survives refresh |
| Dashboard | Borehole/display selection is clear and persistent |
| Workbench | Tracks render; depth click updates metadata; interval edit saves |
| Source metadata | Source files, stages, and correction history are visible |
| Validation/AI | Validation and AI summary produce useful evidence |
| Import | Templates load; source process/merge works for prepared test files |
| Export | Readiness, export generation, download, and audit facts work |
| Correlation | Boreholes compare; AI insights open; saved note persists with author |
| Mobile | Login, interval/runtime parameter entry, file/photo upload path work |
| Deployment | Health, diagnostics, and smoke script pass |

## Recommended Demo Close

End with:

> This UAT build demonstrates the shape of a production geology productivity platform: field data capture, source-controlled import, central interpretation, AI/rule evidence, correlation, export, and deployment governance. The next refinement step should focus on Reliance's exact templates, corebox image packages, approval process, and downstream export requirements.
