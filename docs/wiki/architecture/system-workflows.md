# System Workflows

This document explains how data moves through the borehole correction system.

## Full Demo Flow

```text
Site/mobile/Excel inputs
  -> backend upload/import/mobile endpoints
  -> PostgreSQL normalized borehole model
  -> deterministic validation
  -> AI suggestions and explanations
  -> central geologist visualization and edits
  -> export readiness review
  -> Excel/CSV/LAS export
```

## 1. Borehole Creation

There are currently three creation paths.

### Seeded Demo

```text
python backend/scripts/seed_demo.py
```

Creates PBH demo boreholes with lithology intervals, seams, curves, core images, layouts, and workflow states.

### Excel Import

```text
python backend/scripts/profile_and_import_excel_workbooks.py
```

Or through the UI:

```text
Upload Excel -> Process -> Import borehole
```

The Excel service profiles workbook structure, extracts intervals, remarks, seams, metadata, and synthetic/known curves when available.

### Mobile Field Submission

```text
Flutter app -> POST /api/mobile/demo-copy
Flutter app -> POST /api/mobile/field-submissions
Flutter app -> POST /api/mobile/uploads
```

This simulates a site geologist creating or updating borehole data while the central system remains the source of review and correction.

### Geophysical PDF Import

```text
Pinnacle composite PDF
  -> embedded text/vector profiling
  -> depth-axis and curve-scale calibration
  -> digitized curve samples
  -> PostgreSQL Curve/CurveSample rows
  -> workbench curve track and export readiness
```

This path is useful when the contractor has only provided a plotted composite log. It is an evidence import, not a replacement for raw LAS/CSV/DLIS. See [Geophysical PDF Import](geophysical-pdf-import.md).

## 2. Workbench Load

```text
React App
  -> GET /api/boreholes
  -> user selects borehole
  -> GET /api/boreholes/{id}/workbench
  -> frontend receives BoreholeWorkbench
  -> LogWidget renders tracks
  -> side panels render validation, AI, export, metadata
```

`BoreholeWorkbench` is intentionally broad. It gives the frontend one complete object for the central correction screen.

## 3. Visualization And Interaction

```text
LogWidget
  -> creates shared DepthScale
  -> reads DisplayLayout tracks
  -> renders one track component per visible track
  -> TrackFrame converts mouse Y to depth
  -> track hitTest finds the object under the pointer
  -> interactions.ts updates UI state
```

Examples:

| User Action | Result |
| --- | --- |
| Click lithology interval | Selects interval and shows metadata/edit form. |
| Hover curve | Shows nearest curve sample and related curve values. |
| Click grouped remarks | Opens grouped remarks popup. |
| Click corebox preview | Opens full corebox image. |
| Mouse wheel | Zooms visible depth window. |
| Drag rubber band | Zooms to selected depth range. |
| Right click | Opens context menu with zoom actions. |

## 4. Validation

```text
POST /api/boreholes/{id}/validate
  -> validate_borehole()
  -> replace_validation_issues()
  -> frontend reloads workbench
```

The validation engine is deterministic. It should remain the dependable source of quality findings.

Current rule families:

- interval gaps
- interval overlaps
- missing lithology code
- invalid depth interval
- recovery/RQD issues
- curve depth coverage mismatch

## 5. AI Suggestion Workflow

```text
ValidationIssue rows
  -> AI service creates AiSuggestion rows
  -> optional local OpenAI-compatible model improves wording
  -> suggestions appear in AI panel and AI track
  -> geologist accepts or rejects
```

AI does not own the final corrected log. It presents evidence, rationale, and suggested patches. The central geologist accepts, rejects, or manually edits.

Accepting a patchable suggestion:

```text
POST /api/ai/suggestions/{id}/accept
  -> updates target interval where supported
  -> marks suggestion accepted
  -> writes CorrectionAudit
  -> reruns validation
```

## 6. Manual Correction

```text
Select interval in LogWidget
  -> right panel shows editable form
  -> Save correction
  -> PATCH /api/boreholes/intervals/{interval_id}
  -> CorrectionAudit row
  -> validation rerun
  -> workbench reload
```

Today, the editable fields are:

- lithology code
- lithology label
- seam name
- remarks

Depth boundary editing is a future refinement because it has higher validation and visualization consequences.

## 7. Export Readiness

```text
GET /api/exports/boreholes/{id}/readiness
```

Export is permission-driven in the current UAT build. Readiness checks show validation status, warnings, open AI suggestions, source availability, and curve availability. Validation errors are blocking quality issues; warnings and open suggestions are advisory review items.

## 8. Export Generation

```text
POST /api/exports/boreholes/{id}/jobs
```

A permitted user can generate an export after reviewing readiness. The export job records the selected format/template and generated file. A future production workflow can add second-user approval, notifications, and project-specific export locks if required.

Current export types:

- `corrected_lithology_csv`
- `corrected_lithology_xlsx`
- `curves_csv`
- `curves_las`

Generated files are stored under:

```text
runtime-data/exports/{borehole_code}/
```

## 9. Realtime Refresh

The current UAT build uses server-sent events for server-to-browser refresh notifications.

```text
Write operation
  -> database commit
  -> publish workbench domain event
  -> GET /api/realtime/boreholes/{id}/events stream receives event
  -> frontend invalidates React Query caches
  -> affected widgets refetch canonical API data
```

Events are published for interval correction, display layout changes, validation refresh, AI suggestion changes, import/source-file processing, mobile submissions/uploads, borehole status updates, and export job creation.

This is intentionally an application-level refresh abstraction, not widget-level polling. It keeps curves, lithology, seams, core image state, AI tracks, metadata, import/export panels, and correlation inputs consistent after growing or edited data arrives. A later production renderer can extend this with visible-depth window events, partial curve sample updates, tile invalidation for core images, or a SignalR gateway if a .NET realtime service is introduced.

Final customer-specific Minex export should be added after they provide the exact expected template/import format.

## 9. Local PostgreSQL Flow

The local API currently uses:

```text
postgresql+psycopg://postgres:postgres@localhost:5432/geoworkbench
```

Setup:

```powershell
cd backend
alembic upgrade head
python scripts\seed_demo.py
python scripts\profile_and_import_excel_workbooks.py
python scripts\import_ctsj_ai_test.py
python -m uvicorn app.main:app --host 0.0.0.0 --port 8081
```

The local runtime `.env` file is ignored by git. Use `.env.postgres.example` as the shareable template.
