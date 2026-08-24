# UAT Execution Cut-Line

Updated: 2026-08-24

This page separates the full product roadmap from the Reliance UAT execution list. Use this when deciding what to build next.

## How To Read This

- **Done / ready for manual test** means implementation exists and should be verified in the running app.
- **Build next** means it is still part of the near-term UAT execution list.
- **Defer** means it is important, but should not block the current Reliance UAT unless stakeholders specifically ask for it.

## Done / Ready For Manual Test

| Area | Current state |
| --- | --- |
| Local and Entra login | Web login supports local users and Entra ID configuration. |
| User preferences | Theme, units/timezone/formatting, selected borehole, and selected display context are persisted. |
| Reliance data baseline | Reliance boreholes can be imported into a clean database and opened in the workbench. |
| Workbench widgets | Runtime display supports saved layouts, evidence coverage, log widget, interval details, AI/validation surfaces, source metadata, and correction history. |
| Interval correction | Geologist can edit interval-level fields and save an audited correction. |
| Import Center foundation | Templates, mapping preview, source files, processing/merge actions, and audit facts exist. |
| Export Center foundation | Excel/CSV/LAS exports, readiness checks, profile/mapping preview, and export history exist. |
| Display editor foundation | Full-page editor, widget add/remove/clone, drag/resize grid, undo/cancel/save, dirty-state summary, widget settings, track settings, curve settings, and track clone are available. |
| Correlation foundation | Borehole set selection, depth/RL mode, reference borehole distance context, seam tie-lines, AI/rule insight actions, and saved correlation observations exist. |
| Mobile foundation | Login screen, mobile data-entry/upload path, runtime parameters, and camera/upload path exist. |
| Wiki and deployment docs | User manual, UAT story, architecture notes, Windows/IIS deployment guide, and smoke-script guidance exist. |

## Build Next For Reliance UAT

These are the items that should still be in my execution list before we call the build UAT-ready.

| Priority | Area | Work remaining |
| --- | --- | --- |
| 1 | LogWidget control plane hardening | Make virtual depth, visible depth, scroll, wheel behavior, rubber-band zoom, ruler, click, tooltip, and context menu consistently use one coordinate model. See the developer architecture page [Log Widget Control Plane](../architecture/log-widget-control-plane.md). |
| 2 | Workbench visual readability | Hide or summarize seam/remark labels at low zoom, keep RQD/recovery/core-image empty states clear, and ensure headers fit with real Reliance curves. |
| 3 | Import/merge UAT flow | Make the Excel/LAS import happy path obvious: choose source, choose template, see mapping, choose merge mode, preview, commit, and verify the borehole updates. |
| 4 | Export UAT flow | Make default corrected-log and curve export templates easy to understand, with visible selected fields/curves and generated file audit facts. |
| 5 | Correlation usefulness | Improve the correlation narrative with received-vs-demo dataset separation, clearer tie-line legend, missing seam states, and saved interpretation wording. |
| 6 | Display editor maturity | Continue modularizing widget/track settings so future settings are added through registries rather than one-off UI patches. |
| 7 | Mobile polish | Improve styling and make upload/form progress/status clearer for field-demo confidence. |
| 8 | UAT deployment package | Prepare server deployment with external Postgres, service/restart scripts, reverse proxy notes, health/smoke evidence, and seeded users/roles. |

## Manual Test Only

These should be tested by the team, not treated as new build items unless a failure is found:

- Login, Entra ID, role visibility, and profile menu.
- Borehole/display persistence after refresh.
- Interval edit and correction audit.
- Import of prepared Excel/LAS files.
- Export of prepared corrected-log and curve files.
- Correlation note persistence.
- Mobile login, form submission, file upload, and camera path.
- Health diagnostics and smoke script.

## Defer Unless Stakeholder Demands It Now

| Area | Reason to defer |
| --- | --- |
| Prediction/model training | Needs significantly more paired raw/corrected historical data. |
| Full maker-checker approval | Valuable, but the current UAT can use permission-controlled actions plus audit history. |
| Full Minex template designer | Needs exact Reliance/Minex target requirements. |
| Production corebox lane extraction | Needs real corebox packages, confirmed depth/lane rules, and image-processing confidence review. |
| Map/GIS workspace | Valuable after collar coordinates and section-line requirements are confirmed. |
| Advanced workspace builder for every page | The architecture should move there, but UAT can focus on workbench/display first. |
| Large-scale curve windowing/performance tuning | Needed for very large LAS datasets, but should follow measured performance issues. |

## Rule For Future Answers

When asked "what is left?", answer from **Build Next For Reliance UAT** first. Mention deferred product-roadmap items only if they affect UAT risk or stakeholder expectations.
