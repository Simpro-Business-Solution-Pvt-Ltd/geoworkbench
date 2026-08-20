# Frontend Architecture

The frontend is a React/TypeScript workbench. It has three layers:

```text
API client/types -> App orchestration/state -> reusable workbench visualization components
```

The most important UI is the borehole log widget. It is designed like a lightweight well-log visualization engine, with shared depth scaling, track renderers, typed hit testing, and centralized interaction behavior.

## Entry Points

| File | Purpose |
| --- | --- |
| `frontend/src/main.tsx` | React application bootstrap. |
| `frontend/src/App.tsx` | Main application composition, queries, mutations, panels, selected borehole. |
| `frontend/src/api/client.ts` | All HTTP calls to the FastAPI backend. |
| `frontend/src/api/types.ts` | TypeScript DTOs matching backend API responses. |
| `frontend/src/styles.css` | Current application styling. |

## Main Screen Structure

`App.tsx` lays out three working regions:

```text
Topbar
  -> borehole selector
  -> display editor launcher

Runtime display
  -> renders saved display grid
  -> dispatches each saved widget by type
  -> log widget, single value, validation, AI, export, data arrival, interval details

Display editor dialog
  -> widget collection
  -> display grid canvas
  -> selected widget inspector
  -> right-click widget settings
  -> log widget track/curve settings
```

## Data Fetching

The frontend uses TanStack Query.

| Query/Mutation | Backend Endpoint |
| --- | --- |
| `listBoreholes()` | `GET /api/boreholes` |
| `getWorkbench(id)` | `GET /api/boreholes/{id}/workbench` |
| `updateInterval()` | `PATCH /api/boreholes/intervals/{interval_id}` |
| `runValidation()` | `POST /api/boreholes/{id}/validate` |
| `generateAiSuggestions()` | `POST /api/ai/boreholes/{id}/suggestions/generate` |
| `acceptAiSuggestion()` | `POST /api/ai/suggestions/{id}/accept` |
| `updateAiSuggestionStatus()` | `PATCH /api/ai/suggestions/{id}` |
| `getExportReadiness()` | `GET /api/exports/boreholes/{id}/readiness` |
| `createExportJob()` | `POST /api/exports/boreholes/{id}/jobs` |
| `uploadSourceFile()` | `POST /api/imports/source-files/upload` |
| `processSourceFile()` | `POST /api/imports/source-files/{id}/process` |
| `importSourceFileAsBorehole()` | `POST /api/imports/source-files/{id}/import-borehole` |

After successful mutations, `App.tsx` invalidates the relevant query keys so the workbench reloads fresh server state.

## Workbench Visualization Folder

```text
frontend/src/workbench/
  core/       -> shared visualization math and interaction primitives
  display/    -> display settings, runtime widget shell, and Zustand workbench store
  tracks/     -> one renderer per track type
  widgets/    -> composed widgets, currently LogWidget
  ai/         -> AI panel
  exports/    -> export panel
```

Runtime display rendering is intentionally split:

| Folder/File | Responsibility |
| --- | --- |
| `display/DisplayRuntime.tsx` | Reads saved grid layout, dispatches widgets by type, and keeps runtime shell behavior small. |
| `display/runtime/runtimeTypes.ts` | Shared runtime widget props and callback contracts. |
| `display/runtime/RuntimeWidgetFrame.tsx` | Common widget header/body frame. |
| `display/runtime/SingleValueWidget.tsx` | KPI/metric widget using the unified metric read model. |
| `display/runtime/CurveCatalogWidget.tsx` | Curve coverage, mnemonic, family, mapping status, sample count, and min/max display. |
| `display/runtime/ValidationWidget.tsx` | Validation summary and depth-linked issue selection. |
| `display/runtime/IntervalDetailsWidget.tsx` | Selected-depth interval metadata, core preview, and correction edit launcher. |
| `display/runtime/FloatingIntervalEditor.tsx` | Draggable interval correction form. |
| `display/runtime/intervalMetadata.tsx` | Borehole metadata extraction for the interval panel. |

## Workbench Core

| File | Responsibility |
| --- | --- |
| `depthScale.ts` | Maps depth to Y, Y to depth, and intervals to CSS positions. |
| `ticks.ts` | Generates nice depth ticks for zoom levels. |
| `curveMath.ts` | Curve point normalization, visible/boundary sample selection, nearest sample search. |
| `TrackFrame.tsx` | Shared wrapper for track title, body, hover/click/context-menu, hit-test dispatch. |
| `trackObject.ts` | Typed objects returned by hit testing: interval, seam, curve sample, remark group, core image, empty. |
| `interactions.ts` | Central application behavior for clicks, hover, context menu. |

## Track Model

Every track follows this shape:

```text
TrackFrame
  -> receives BoreholeWorkbench, DisplayTrack, DepthScale
  -> renders track body
  -> implements hitTest(depth, localX, localY)
  -> returns TrackObject
  -> central handler decides what the click/hover means
```

Current track renderers:

| Track | File | Purpose |
| --- | --- | --- |
| Depth | `tracks/depth/DepthTrack.tsx` | Depth ticks and depth-axis hit testing. |
| Lithology | `tracks/lithology/LithologyTrack.tsx` | Colored lithology intervals. |
| Seam | `tracks/seam/SeamTrack.tsx` | Coal seam markers. |
| Recovery/RQD | `tracks/quantitativeBar/QuantitativeBarTrack.tsx` | Quantitative interval bar tracks. |
| Curves | `tracks/curve/CurveTrack.tsx` | Multi-curve normalized curve rendering and tooltips. |
| Remarks | `tracks/remarks/RemarksTrack.tsx` | Grouped remarks to avoid clutter. |
| AI Suggestions | `tracks/aiSuggestions/AiSuggestionsTrack.tsx` | Depth-aligned suggestion markers. |
| Images | `tracks/images/ImageTrack.tsx` | Available for image interval rendering; current UX mainly uses right-panel corebox preview. |

## State

`frontend/src/workbench/display/workbenchStore.ts` is the lightweight UI store.

It holds:

- runtime/edit mode
- selected depth
- selected lithology interval
- hovered track object
- selected corebox image
- selected remark group
- context menu state
- current visible depth window

Server data still lives in TanStack Query. The store is only for UI interaction state.

## Display Editor

Display settings are persisted as JSON in `DisplayLayout.settings`.

The current shape is:

```text
settings.schemaVersion
settings.regions
settings.grid.items[]
settings.widgets[widgetId]
settings.widgets["log-widget"].tracks[]
```

The display editor is launched from the topbar. It uses a draft copy of the saved layout, so editing can support:

- Save display
- Undo one step
- Cancel the full edit session and keep the original
- Reset default
- Add widget from widget collection
- Remove widget
- Clone widget
- Drag widgets directly to a grid location
- Resize widgets directly from the lower-right resize handle
- Right-click a widget to open widget settings

Widget-level concepts:

| Concept | Meaning |
| --- | --- |
| Display | Whole saved layout JSON for a borehole. |
| Widget collection | Available widget types, such as single value, log widget, AI workflow, validation, export, data arrival. |
| Widget | A display unit with type, title, settings, and optional nested internals. |
| Grid item | Position and size for a widget: `x`, `y`, `w`, `h`. |
| Widget settings | Dialog opened from widget right-click or inspector. |
| Log widget settings | Nested settings for tracks and curves. |

Log widget track config has:

- `id`
- `type`
- `title`
- `visible`
- `width`
- optional curve configs
- optional quantitative field config

`DisplayEditorDialog.tsx` owns the edit session. `DisplayRuntime.tsx` renders the saved display grid during runtime and delegates each widget to a file under `display/runtime/`. `displayEditorModel.ts` owns catalog/default/normalization helpers. `LogWidget.tsx` uses the saved log widget settings to decide which track components to render.

## Adding A New Track

1. Add config defaults in `backend/app/domains/display_layouts/defaults.py`.
2. Add the TypeScript rendering component under `frontend/src/workbench/tracks/<track>/`.
3. Wrap it in `TrackFrame`.
4. Use `DepthScale`; do not write separate depth math.
5. Add a `hitTest`.
6. Add the renderer switch in `LogWidget.tsx`.
7. Add the track to `displayEditorModel.ts` catalog if users should be able to re-add it.
8. Add behavior to `interactions.ts` only if click/hover/context-menu should do something new.

## Adding A New Widget

1. Add a widget catalog entry in `displayEditorModel.ts`.
2. Add any widget-specific persisted settings to `DisplayWidget` in `api/types.ts`.
3. Add widget settings controls under `display/editor/`.
4. Add runtime rendering under `display/runtime/`.
5. Keep widget internals nested under `settings.widgets[widgetId]`.
6. Keep `DisplayRuntime.tsx` as a dispatch shell; avoid putting widget-specific forms or analytics logic back into it.

## Refinement Hotspots

| Need | Start Here |
| --- | --- |
| Improve visual display | `LogWidget.tsx`, track components, `styles.css` |
| Change click/hover behavior | `core/interactions.ts`, `TrackFrame.tsx`, track `hitTest` |
| Improve curve rendering | `core/curveMath.ts`, `tracks/curve/CurveTrack.tsx` |
| Improve display settings | `display/DisplayEditorDialog.tsx`, `display/displayEditorModel.ts`, backend layout defaults |
| Improve runtime display rendering | `display/DisplayRuntime.tsx`, `display/displayEditorModel.ts` |
| Add side-panel metadata | `App.tsx` right panel and backend workbench schema |
| Add AI workflow UI | `workbench/ai/AiWorkflowPanel.tsx`, `tracks/aiSuggestions` |
| Add export controls | `workbench/exports/ExportPanel.tsx` |
