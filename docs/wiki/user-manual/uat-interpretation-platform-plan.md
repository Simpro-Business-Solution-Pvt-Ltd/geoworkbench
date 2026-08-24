# UAT Interpretation Platform Plan

Updated: 2026-08-24

This page tracks the current Reliance UAT direction. It is written for product, demo, and geology discussion, not as a low-level developer design note.

## Purpose

GeoWorkbench should prove one clear workflow:

```text
Raw data from site, Excel, LAS, and images
  -> import, template mapping, validation, and source traceability
  -> AI/rule-assisted review and visualization
  -> geologist interpretation and correction
  -> saved corrected data with history
  -> export for downstream mining/geology tools
```

The application should not simply display boreholes. It should help the geologist make faster, more consistent, evidence-backed decisions.

## Pass 1: Understand The Data We Receive

For each customer data package, first profile the files before deciding UI behavior.

| Data area | Current Reliance status | Meaning | Where it should appear |
| --- | --- | --- | --- |
| Borehole identity | Available for 10 MGCA boreholes | Master object for selection, import, export, workbench, correlation | Dashboard, workbench header, export/import scope |
| Collar/location | Coalgrid and UTM Easting/Northing available | Spatial context for borehole comparison and correlation | Borehole metadata, correlation context, future map widget |
| Reduced level/elevation | Not visible in current collar data | Required for true RL/elevation correlation | Correlation metadata warning; request from Reliance |
| Water level | Not visible in current collar data | Useful hydro/geotechnical context where relevant | Borehole metadata if supplied |
| Lithology intervals | Available | Core interval interpretation record | Lithology track, interval details, edit form, export |
| Seam intervals/picks | Available | Coal seam markers and correlation evidence | Seam track, correlation display, AI insight evidence |
| Recovery | Available for many intervals | Core recovery/quality evidence | Recovery track, interval details, quality rules |
| RQD | No values in current Reliance import | Rock quality/geotechnical evidence where supplied | RQD track and interval details when data exists |
| LAS curves | Available | Geophysical support for lithology/seam interpretation | Curve tracks, curve catalog, correlation, AI evidence |
| Corebox images | Not supplied for current Reliance package | Visual evidence for core condition and lithology | Core image track shows a missing-image state until linked image packages are supplied |
| Remarks/features | Available where present | Field/geologist observations | Remarks track, interval details, AI context |
| Source/import batches | Available as parsed import records | Traceability from source package to model | Import Center, metadata, audit facts |

Acceptance checks for this pass:

- The workbench clearly shows which useful tracks are available for the selected borehole.
- Empty data areas are not presented as if they are missing due to a software bug.
- Missing RL/elevation, water level, RQD, or core images are framed as data availability items.
- Import/export templates show a readable mapping preview before the advanced JSON editor.
- Existing saved displays may need reset or reimport with the latest Reliance layout defaults to show the explicit missing-core-image track state.
- The team can answer: "What did Reliance provide, what did we derive, and what do we still need?"

## Pass 2: Raw Data To Corrected Interpretation

The correction workflow should preserve raw source data and let the geologist create a corrected interpretation.

Correctable fields for the first production slice:

| Field | Why it matters | Display impact |
| --- | --- | --- |
| From/to depth | Controls interval boundaries and thickness | Lithology, seam, recovery/RQD, remarks, export |
| Lithology code/label | Main geological interval interpretation | Lithology pattern/color track and metadata |
| Seam name/marker | Needed for coal seam review and correlation | Seam track and correlation display |
| Recovery/recovery percent | Quality and core condition evidence | Recovery track and metadata |
| RQD | Geotechnical quality evidence where supplied | RQD track and metadata |
| Structural features | Fractures, cleats, weathering, other evidence | Interval details and AI context |
| Remarks | Geologist explanation and observations | Remarks track and metadata |
| Core image link | Visual evidence for the interval | Core image track/viewer |
| Correction reason | Audit and learning loop | Correction history |

Display rule:

When the geologist edits and saves a corrected value, the affected track or widget must update immediately. For example:

- seam name change updates seam track and correlation evidence.
- recovery/RQD change updates quality tracks and interval metadata.
- lithology change updates lithology track and export-ready interval data.
- remarks change updates remarks track and correction history.
- raw/imported interval stages appear as correction-progress work items in the interpretation queue.

For UAT, a single-user correction and audit trail is acceptable. A full maker-checker approval workflow can be staged after the stakeholders validate the correction process.

## Geologist Value Model

Every widget should answer one of these questions.

| Question | Supporting capability |
| --- | --- |
| What data do I have for this borehole? | Borehole metadata, source imports, curve catalog, track availability |
| Where are the important intervals? | Lithology, seam, remarks, recovery/RQD, AI tracks |
| Does the geophysical evidence support the log? | Curve tracks, curve coverage, curve/lithology insights |
| What looks inconsistent or incomplete? | Rules, validation, AI summary, missing data indicators |
| What changed from raw to corrected? | Correction stage, before/after audit, corrected display |
| Are seams consistent across boreholes? | Correlation display, seam continuity insights, saved interpretation notes |
| Can I hand this to another system? | Export readiness, templates, generated Excel/CSV/LAS |

## Correlation Widget Purpose

The correlation display should become a decision workspace, not only a multi-borehole picture.

Current useful outputs:

- compare selected boreholes by lithology and seam markers.
- show normalized Natural Gamma/geophysical response where curves exist.
- show depth alignment and RL alignment mode.
- save geologist correlation observations.

Needed UAT refinements:

- show a compact collar/spatial context table for selected boreholes.
- compute distances from a selected/reference borehole using coordinates.
- clearly mark RL mode as estimated/limited when collar RL is missing.
- show seam continuity/missing seam/thickness variation insights as actionable cards.
- each insight should allow "mark reviewed", direct "save observation", note drafting, and follow-up through the workbench.

Example insight wording:

| Insight | Value |
| --- | --- |
| Seam A appears in 8 of 10 selected boreholes | Supports continuity review |
| Seam B is missing in MGCA-12 but present in nearby boreholes | Prompts pinch-out, fault, or logging check |
| Seam C thickness varies from 0.8 m to 3.2 m | Prompts geometry or interpretation review |
| Gamma coverage is incomplete for MGCA-21 | Warns confidence is lower for curve-supported interpretation |
| RL is defaulted because collar elevation is not supplied | Prevents false structural interpretation |

## Display And Widget Platform Plan

The current system has started modularization, but the final product pattern still needs refinement.

### Current Foundation

- Display layouts are stored and can be selected.
- Log tracks are rendered through a track registry.
- Some track renderers are separated by type.
- Log viewport math has started moving into shared utilities.
- User preference and selected borehole/display context are persisted.
- Import, export, correlation, and workbench are separate workspaces.

### Required Product Platform Work

| Area | Target behavior |
| --- | --- |
| Workspace surfaces | Dashboard, workbench, import, export, correlation, and AI/analytics should use a common configurable surface model |
| Widget registry | Widgets should declare renderer, settings editor, default size, supported workspace, permissions, and data bindings |
| Display editor | Full-page editor with add/remove/clone/drag/resize/undo/cancel/save |
| Widget settings | Settings split by widget, track, curve, interaction, units, and renderer behavior |
| Track registry | Track type controls renderer, hit testing, context menu, tooltip, settings, and display defaults |
| Log control plane | One consistent source for virtual depth, visible depth, scroll, zoom, ruler, rubber-band zoom, right-click, tooltip, and selection |
| Unit settings | User/project display units should affect labels, curve scales, and exports consistently |
| Data read model | Widgets should consume domain APIs or derived metrics, not file-specific source formats |

## UAT Milestones

### Milestone A: Data Meaning And Visibility

Status: in progress; mapping preview and core data-availability messaging are available.

Acceptance:

- Reliance boreholes are isolated from old demo data.
- Collar coordinates appear in borehole metadata.
- Missing RQD/core image/RL/water level is explainable.
- Track visibility is data-driven and configurable.

### Milestone B: Corrected Interpretation Loop

Status: partially available; interval edit, audit history, and correction-progress queue are available.

Acceptance:

- Geologist can edit interval interpretation fields.
- Saved edits update the workbench display.
- Correction history records before/after and user.
- Raw/imported vs corrected stage is visible.

### Milestone C: Correlation As Interpretation Workspace

Status: foundation available; insight actions and saved observations are available, visual refinement continues.

Acceptance:

- Selected boreholes are clear.
- Collar/spatial context is shown.
- Seam continuity and missing seam insights are actionable.
- RL mode is disabled or clearly labelled when RL/elevation is missing.
- Geologist notes persist with author and timestamp.

### Milestone D: Visualization Control Plane

Status: foundation available, needs hardening.

Acceptance:

- Full virtual depth is always preserved.
- Scroll, zoom, ruler, click, drag, tooltip, and context menu use one shared coordinate model.
- Track renderers do not recalculate global depth state.
- Low-zoom labels are hidden or summarized when they reduce readability.

### Milestone E: Configurable Workspace Platform

Status: planned/refactoring path.

Acceptance:

- Dashboard/workbench/import/export/correlation use a consistent widget model.
- Display editor is a full page.
- Widgets and tracks can be added, removed, resized, cloned, configured, saved, cancelled, and undone.
- Settings are structured enough for future widgets without rewriting the editor.

## Reliance Data Questions To Confirm

- Are current Excel files raw field logs, corrected logs, or final approved logs?
- Can Reliance provide raw and corrected versions for the same boreholes?
- Which interval fields are mandatory in the final corrected borehole log?
- Do they maintain RL/elevation, water level, drilling method, date, contractor, and site geologist in another master sheet?
- Are RQD values part of their regular workflow, or only for some boreholes/projects?
- Which LAS curves are most important for coal seam interpretation in their process?
- What exact Minex or other downstream import template should exports satisfy?
- What should be treated as a seam marker versus a lithology interval attribute?
- How should correlation observations be approved or versioned in their team?
