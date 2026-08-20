# GeoWorkbench Product Refactoring Milestones

This roadmap turns the prototype into a configurable geology productivity platform that can support Reliance evaluation/UAT, later customer deployments, and future mining widgets without rewriting the application every time a new workflow is added.

The product story for Reliance should be:

> GeoWorkbench provides role-specific, AI-assisted geology workspaces for mobile capture, borehole correction, import/export, correlation, analytics, and approval. Users can start from curated default layouts and then arrange the widgets they need for their journey.

## Product Pillars

- Configurable workspace surfaces for dashboard, borehole workbench, import, export, correlation, AI/analytics, and admin.
- Unified canonical data model for boreholes, intervals, curves, images, validation, AI suggestions, source files, and flexible attributes.
- Unified read model for widgets so single-value, chart, map, metadata, rules, and AI widgets do not care whether data came from Excel, LAS, mobile, or derived analytics.
- Stable geology visualization kernel for depth-based log tracks, curves, images, selections, zoom, scroll, and context actions.
- Rule-driven and local-LLM-assisted insights that cite evidence and let geologists override/save observations.
- Enterprise readiness: local users, Entra ID, roles/access, preferences, units/timezone, deployment, health diagnostics, and user/developer documentation.

## Immediate Execution Order

For Reliance evaluation, prioritize work that makes the system feel purpose-built and reduces demo/UAT risk:

1. Workspace foundation:
   - reuse the current display-grid engine as a generic workspace surface.
   - introduce workspace kinds and default layouts for dashboard, workbench, import, export, correlation, and AI/analytics.
   - keep global selectors outside the dropzone.
2. Preferences and metrics:
   - add user preferences for units, timezone, date/number formatting.
   - add shared frontend formatting/conversion utilities.
   - introduce the `BoreholeMetric` read model so KPI widgets can show values from Excel, LAS, mobile, or derived analytics uniformly.
3. Reliance data cleanup:
   - isolate Reliance boreholes from dummy/demo projects.
   - ensure collar, coordinates, water level, intervals, LAS curves, source files, and metadata are consistently available.
4. LogWidget stability:
   - complete canonical virtual-depth/visible-depth/scroll/zoom/ruler behavior.
   - verify full-depth and zoomed behavior on Reliance boreholes.
5. Import/export product flow:
   - make templates, mapping, merge mode, preview, commit, and export selection first-class workspace widgets.
6. AI and analytics:
   - expose rules, data-quality, curve coverage, seam continuity, and local-LLM summaries as configurable widgets.
7. Correlation:
   - build the geologist-facing correlation workspace around selected borehole sets, depth/RL mode, seam markers, curves, and evidence-backed insights.
8. Deployment hardening:
   - external Postgres, reverse proxy, health checks, service restart behavior, UAT documentation, and seeded role/user setup.

## Guiding Design

The application should be composed from registries and stable control models:

- `WorkspaceShell` owns selected project, borehole(s), workspace/display, runtime/edit mode, user preferences, global filters, save/cancel/undo state, and navigation actions.
- `WorkspaceSurface` owns the configurable grid/dropzone for a specific journey.
- `DisplayLayoutEngine` owns grid placement, drag, resize, clone, add/remove widgets, save, cancel, and undo.
- `WidgetRegistry` defines available widget types, default settings, runtime renderer, settings editor, default grid size, supported workspace kinds, and permissions.
- `LogWidgetCore` owns depth transforms, virtual depth, visible depth, scrolling, zooming, ruler, rubber-band zoom, context menu, tooltip routing, and selected object state.
- `TrackRegistry` defines available log tracks, default settings, renderer, settings editor, hit testing, and context-menu actions.
- Track renderers should not calculate global depth state. They receive a resolved control context and render only their own objects.

## Workspace Model

Each major page should become a workspace surface, with a small fixed shell around it:

```text
Workspace
  id
  kind: dashboard | borehole-workbench | import | export | correlation | ai-analytics | admin
  scope: user | project | role | system
  settings
  grid
  widgets[]

Widget
  id
  type
  title
  position/size
  settings
  data bindings
  permissions
```

Controls outside the dropzone should be limited to global selection/context:

- project/site/borehole or borehole set selection.
- workspace/display selection.
- active/historic filter.
- depth/RL mode where relevant.
- role/user/profile actions.
- save/clone/reset/edit mode.
- notification/status indicators.

Everything else should become widgets where practical.

Initial workspace kinds:

- Dashboard: borehole portfolio, active/historic grids, recent imports, validation/rules counts, AI summary, map/collar summary.
- Borehole Workbench: LogWidget, interval editor, metadata, curve catalog, AI suggestions, validation, core image viewer.
- Import Center: source files, template registry, mapping preview, merge rules, import history, validation preview.
- Export Center: export settings, field/curve selection, readiness, generated files, export history.
- Correlation Workspace: multi-borehole selector, depth/RL correlation display, seam continuity insights, curve coverage.
- AI/Analytics Workspace: rules dashboard, LLM insight summaries, data quality, anomalies, saved observations.

## Unified Data And Widget Read Model

Do not force all data into one generic table. Use strong domain tables plus flexible attributes and derived read models:

Strong storage:

- `boreholes`
- `lithology_intervals`
- `curves`
- `curve_samples`
- `core_images`
- `validation_issues`
- `ai_suggestions`
- `source_files`
- `display_layouts` / future `workspace_layouts`

Flexible extension points:

- `borehole.attributes`
- `lithology_interval.attributes`
- `curve.metadata`
- `source_file.mapping/profile`
- future `runtime_parameters`

Derived widget read model:

```text
BoreholeMetric
  key
  label
  value
  unit
  category
  source
  confidence
  updated_at
```

Examples:

- total depth from Excel/import.
- collar RL, coordinates, water level from Excel/mobile.
- curve count and curve coverage from LAS.
- max/min/average gamma/resistivity/density from curve samples.
- seam count and thickness from intervals.
- average recovery/RQD from Excel interval fields.
- validation issue count from rules.
- AI insight count/confidence from suggestions.

Widgets should consume `BoreholeMetric` and domain APIs instead of knowing whether the original data came from LAS, Excel, mobile, PDF, or derived analytics.

## Curve Dictionary And Mnemonic Strategy

Curves should be generic measurements, not hardcoded UI types.

Curve storage/configuration should include:

- mnemonic/key from source.
- canonical curve family if known.
- display label.
- source unit.
- depth index.
- value samples.
- source file/import profile.
- metadata JSON.
- display config: color, scale, normalization, line style, visibility, tooltip.

Maintain a curve dictionary/mnemonic registry that can evolve with Reliance LAS files:

```text
NGAM, GAMMA, GR        -> gamma-ray
RS, RES, RILD          -> resistivity
DENS, RHOB             -> density
CAL, CALP              -> caliper
BD                     -> bed-resolution-density-cps
DV                     -> inclination/deviation
AZ                     -> azimuth
```

Unknown mnemonics should still import as curves, remain selectable in widgets, and be marked as unmapped until a user/admin maps them.

## Unit, Timezone, And Formatting Strategy

Add preferences as a platform service rather than widget-specific logic.

Preference scopes:

- user preference.
- role/project default.
- workspace/display override later.

Initial fields:

```text
unitSystem: metric | mining_metric | imperial | custom
depthUnit: m | ft
lengthUnit: m | cm | mm | ft | in
coordinateUnit: m | ft
densityUnit: g/cc | kg/m3
timezone: Asia/Kolkata | UTC | ...
dateFormat
numberFormat
```

Shared formatter/converter services:

- `formatDepth(value, preferences)`
- `formatMeasurement(value, sourceUnit, targetUnit, preferences)`
- `formatCoordinate(value, preferences)`
- `formatDateTime(value, preferences.timezone)`

Rules:

- Store raw source values and units.
- Convert only for display/export unless an import template explicitly transforms source data.
- Curve display settings can use source unit, preferred unit, or manual override.
- When display unit changes, reset or convert min/max scale ranges consistently.
- Timezone is important for mobile submissions, import/export history, approval workflow, and runtime parameters even if depth tracks are not time-based today.

## Frontend Modularity Rules

Keep files intentionally small and shaped around one responsibility:

- Page/shell components: target 150-250 lines; split once they approach 300 lines.
- Complex settings panels: target 150-250 lines; split per widget/track/object type.
- Pure utilities and hooks: target below 120 lines.
- Renderers for specialized tracks can exceed this briefly, but should split hit testing, geometry, and settings once new behavior is added.
- Avoid placing registry definitions, renderer code, settings forms, layout utilities, and interaction math in the same file.

Recommended folders:

```text
frontend/src/workbench/display/
  DisplayEditorDialog.tsx        # shell/orchestration only
  displayEditorModel.ts          # catalog/default layout model
  editor/
    DisplayGridCanvas.tsx
    WidgetInspector.tsx
    WidgetSettingsDialog.tsx
    LogWidgetSettings.tsx
    CurveTrackSettings.tsx
    displayGridUtils.ts
    useElementWidth.ts
```

## Library Strategy

Use proven libraries where they reduce interaction risk, but keep geology-specific behavior inside GeoWorkbench:

- D3 micro-packages for depth/value scales, inverse transforms, ticks, and formatting.
- `dnd-kit` for future custom drag/drop interactions in settings panels and editor surfaces where we need full control.
- `react-grid-layout` for workspace/display grid surfaces where widgets are dragged/resized and saved as `{ x, y, w, h }`.
- `uPlot` remains a candidate for dense curve rendering if SVG/polyline rendering becomes a bottleneck on large LAS datasets.
- Corebox image tiling should follow a map-style pyramid/tile architecture later, but the geology-specific lane extraction and depth metadata remain our model.

Adopted dependencies so far:

- D3 scale/tick utilities for LogWidget coordinate stability.
- React Grid Layout for display/widget grid editing.

## Milestone A - Reliance Product Baseline

Goal:

Reframe the prototype as a customer-evaluation product with clean navigation, default user journeys, and configurable workspaces.

Scope:

- Define workspace kinds: dashboard, borehole workbench, import, export, correlation, AI/analytics, admin/settings.
- Keep only global selectors and account/status controls outside workspace surfaces.
- Create curated default layouts per user journey:
  - central geologist correction.
  - import operator.
  - export/admin.
  - correlation analyst.
  - management dashboard.
- Store/reuse workspace layouts using the existing display layout model as the starting point.
- Make widget library generic and workspace-aware.

Acceptance:

- User can choose a workspace and see a relevant default layout.
- Workspace surfaces use the same widget/grid model.
- Existing workbench display editing continues to work.
- The product story is explainable as configurable AI-assisted geology workspaces, not a fixed demo page.

## Milestone B - Reliance Data Foundation

Goal:

Make the UAT database represent real Reliance boreholes cleanly, while keeping earlier demo/dummy data isolated.

Scope:

- Import Reliance Excel and LAS files into canonical borehole, lithology interval, curve, and metadata tables.
- Store collar, coordinate, water-level, source-file, and import metadata consistently.
- Mark missing corebox images as a display state, not a validation failure.
- Keep dummy/demo boreholes clearly separated from Reliance projects.
- Verify workbench serialization does not load excessive curve samples.

Acceptance:

- Reliance project/site/boreholes are visible from the landing page and workspaces.
- Each borehole opens with lithology and available LAS curves.
- Metadata panel shows collar/coordinate/water-level fields where available.
- Missing corebox data is shown as an empty image-track state.
- Dummy data is not mixed into the Reliance project unless explicitly selected as a demo dataset.

## Milestone C - Unified Metrics, Units, And Preferences

Goal:

Make widgets independent of whether values came from Excel, LAS, mobile, source metadata, or analytics.

Scope:

- Add user preferences for unit system, depth/length/density/coordinate units, timezone, date format, and number format.
- Add shared format/conversion utilities.
- Add derived `BoreholeMetric` read model/service.
- Populate initial metrics:
  - total depth.
  - collar RL/coordinates/water level.
  - curve count.
  - interval count.
  - seam count/thickness.
  - recovery/RQD summaries where available.
  - validation and AI suggestion counts.
- Update single-value widgets to use metric keys rather than hardcoded source-specific logic.

Acceptance:

- User preferences persist after refresh.
- Selected borehole and display choice persist after refresh.
- Timestamps use the selected timezone.
- Depth/measurement formatting is centralized.
- Single-value widgets can show values from Excel, LAS, mobile, or derived analytics through the same metric contract.

## Milestone D - LogWidget Control Plane

Goal:

Make depth-based interaction stable enough for customer UAT.

Scope:

- Define one canonical transform model:
  - virtual depth domain: full borehole/log domain plus small bottom padding.
  - visible depth span: current viewport depth window.
  - content coordinates: full scrollable body pixels.
  - viewport coordinates: visible body pixels after scroll.
- Refactor scroll, wheel, rectangular zoom, click, drag, ruler, tooltip, and context menu to use the same transform.
- Ensure headers are excluded from depth calculations.
- Add lightweight diagnostic hooks for current domain, visible range, scrollTop, pixels-per-meter, and pointer depth.

Acceptance:

- Full depth mode shows the full virtual depth with bottom padding.
- Zoom changes visible span but never shrinks the virtual domain.
- Scroll can reach the true top and bottom at every zoom.
- Clicked depth, ruler depth, selected interval, tooltip, and depth metadata agree.
- Rubber-band zoom uses the selected depth range and preserves scrollability.

## Milestone E - Registry-Driven Tracks

Goal:

Make log tracks modular so new track types and settings can be added without editing the core widget.

Scope:

- Introduce a `TrackRegistry` with definitions for depth, lithology, seam, core images, recovery, RQD, curve, remarks, AI suggestions, and custom future tracks.
- Move runtime track resolution out of `LogWidget`.
- Define track-level settings shape:
  - identity, title, visibility, width/order.
  - header settings.
  - renderer settings.
  - interaction settings.
  - object/curve bindings.
- Keep existing display JSON compatible through normalization.

Acceptance:

- Existing displays render identically after registry migration.
- Unknown track types fail gracefully with a clear placeholder.
- Adding a new track type requires adding one registry definition and one renderer/settings module.

## Milestone F - Widget Registry And Display Layout Engine

Goal:

Make display/workspace editing behave like a real configurable workspace.

Scope:

- Introduce/refine a `WidgetRegistry` with default widget size, runtime component, settings editor, permissions, supported workspace kinds, and clone behavior.
- Move display/workspace edit from modal-first behavior toward a full-page editor.
- Support direct grid drag, resize, add, remove, clone, undo, save, and cancel.
- Store workspace/display layouts as versioned JSON with migration/normalization.
- Keep runtime workspace exactly equal to saved layout.

Acceptance:

- Users can add/remove/clone widgets from a compact icon catalog.
- Widgets can be moved and resized directly on the grid.
- Cancel restores the original layout.
- Undo reverses the last edit step.
- Saved layout persists after refresh and login.

## Milestone G - Deep LogWidget Settings

Goal:

Make log widget configuration useful for geologists, not just a prototype toggle panel.

Scope:

- Track add/remove/reorder/width/visibility.
- Track header configuration.
- Curve-track support for multiple curves, per-curve visibility, color, unit, normalization range, scale mode, and line style.
- Lithology colors/patterns and label behavior.
- Core image track missing-state and processed-image display preferences.
- Tooltip and context-menu behavior per track/object.
- Save widget settings as reusable templates.

Acceptance:

- A geologist can build a log display with only the tracks/curves needed for a workflow.
- Curve settings show all curves available for the borehole.
- Multi-curve normalization keeps all selected curves visible in the same track.
- Settings are stored inside the display layout and can be cloned.

## Milestone H - Import/Export Product Flow

Goal:

Make import/export a product capability, not a side panel.

Scope:

- Import Center as a full workflow: source files, template selection, preview, mapping, merge rules, validation, and commit.
- Merge modes for intervals and curves:
  - append new depths.
  - replace selected depth range.
  - replace curves by key.
  - append new curves only.
- Export Center as a full workflow: borehole selection, format, template, field/curve selection, readiness, and generated file history.
- Editable import/export templates with a UI-backed JSON view only where advanced users need it.

Acceptance:

- Excel import can map known Reliance lithology templates.
- LAS import can create/update all discovered curves.
- Export can produce corrected Excel/CSV and curve LAS/CSV from stored data.
- User can inspect what source fields map to model fields and what model fields export.

## Milestone I - Correlation And AI Value Layer

Goal:

Turn imported borehole data into geologist-facing insight.

Scope:

- Correlation display with selected borehole set, depth/RL mode, seam/formation markers, and curve overlays.
- Rules insights for gaps, overlaps, missing intervals, seam continuity, curve coverage, and suspicious lithology/curve mismatch.
- Local LLM summaries using deterministic evidence from stored intervals, curves, and validation issues.
- Keep predictive ML as future scope until adequate labeled data exists.

Acceptance:

- Geologist can compare multiple boreholes against depth or RL.
- Correlation insights cite the boreholes, depths, and evidence used.
- AI output is advisory and tied to visible data/rules.
- Geologist can save observations or override interpretations.

## Milestone J - UAT Deployment Hardening

Goal:

Prepare a stable customer-evaluation deployment.

Scope:

- External PostgreSQL deployment profile.
- IIS or Nginx reverse proxy.
- Podman/service scripts where useful for reboot resistance.
- Health diagnostics page.
- Seeded admin/local users and Entra ID configuration guide.
- User manual available from the app; developer architecture docs gated for developer/admin roles.

Acceptance:

- Server can be rebuilt from documented steps.
- Services survive restart.
- Database backup/restore is documented.
- User-facing help explains current capabilities and UAT limitations without cluttering the application screens.
