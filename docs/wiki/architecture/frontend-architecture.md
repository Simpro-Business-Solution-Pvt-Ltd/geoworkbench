# Frontend Architecture

The frontend is a React/TypeScript workbench. It has three layers:

```text
API client/types -> App orchestration/state -> reusable workbench visualization components
```

The most important UI is the borehole log widget. It is designed like a lightweight well-log visualization engine, with shared depth scaling, track renderers, typed hit testing, and centralized interaction behavior. Use [Workbench UI Management Architecture](workbench-ui-management.md) for the final-pass UI pattern, and [LogWidget Architecture](log-widget.md) as the primary reference for widget configuration, track/curve extensibility, settings, and renderer contracts.

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
  widgets/    -> composed widgets, including widgets/logWidget
  ai/         -> AI panel
  exports/    -> export panel
```

Runtime display rendering is intentionally split:

| Folder/File | Responsibility |
| --- | --- |
| `display/DisplayRuntime.tsx` | Reads saved grid layout, dispatches widgets by type, and keeps runtime shell behavior small. |
| `display/runtime/runtimeTypes.ts` | Shared runtime widget props and callback contracts. |
| `display/runtime/runtimeWidgetRegistry.tsx` | Runtime widget registry and fallback renderer for unknown widget types. |
| `display/runtime/RuntimeWidgetFrame.tsx` | Common widget header/body frame. |
| `display/runtime/SingleValueWidget.tsx` | KPI/metric widget using the unified metric read model. |
| `display/runtime/CurveCatalogWidget.tsx` | Curve coverage, mnemonic, family, mapping status, sample count, and min/max display. |
| `display/runtime/ValidationWidget.tsx` | Validation summary and depth-linked issue selection. |
| `display/runtime/IntervalDetailsWidget.tsx` | Selected-depth interval metadata, core preview, and correction edit launcher. |
| `display/runtime/FloatingIntervalEditor.tsx` | Draggable interval correction form. |
| `display/runtime/intervalMetadata.tsx` | Borehole metadata extraction for the interval panel. |

Shared read-model helpers:

| File | Responsibility |
| --- | --- |
| `metrics/boreholeMetrics.ts` | Builds derived `BoreholeMetric` values from borehole, interval, curve, source, validation, and AI data. |
| `metrics/metricCatalog.ts` | Lists selectable KPI metrics for single-value widgets. |
| `data/curveDictionary.ts` | Classifies imported curves by mnemonic/key into canonical families for display and widget settings. |

## Workbench Core

| File | Responsibility |
| --- | --- |
| `depthScale.ts` | Maps depth to Y, Y to depth, and intervals to CSS positions. |
| `logViewport.ts` | Pure virtual-depth, visible-depth, scroll, zoom, and pointer-depth math. |
| `logViewportController.ts` | Pure controller state transitions for scroll, zoom, rubber-band zoom, and full-depth reset. |
| `logWidgetControlPlane.ts` | Public LogWidget facade for virtual depth, visible depth, transforms, scroll/zoom transitions, pointer resolution, and diagnostics. |
| `useLogWidgetControlPlane.ts` | React hook that synchronizes the control plane with the scroll DOM element. |
| `useLogViewportController.ts` | Compatibility adapter over `useLogWidgetControlPlane.ts`. |
| `trackPointerMapping.ts` | Converts browser client coordinates into track-local X, content Y, and depth. |
| `ticks.ts` | Generates nice depth ticks for zoom levels. |
| `curveMath.ts` | Curve point normalization, visible/boundary sample selection, nearest sample search. |
| `tracks/curve/curveRenderModel.ts` | Converts configured curves and depth/value scales into renderer-ready polyline models. |
| `tracks/curve/curveHitTestModel.ts` | Converts pointer depth into nearest curve sample objects and multi-curve tooltip payloads. |
| `tracks/curve/curveWindowData.ts` | Pure helpers for visible-window curve sample identity, cache keys, and sample replacement. |
| `tracks/curve/useCurveWindowData.ts` | Optional TanStack Query bridge for fetching curve samples by visible depth window. |
| `TrackFrame.tsx` | Shared wrapper for track title, body, hover/click/context-menu, hit-test dispatch. |
| `trackObject.ts` | Typed objects returned by hit testing: interval, seam, curve sample, remark group, core image, empty. |
| `interactions.ts` | Central application behavior for clicks, hover, context menu. |

## Realtime Refresh Layer

Realtime refresh is handled above individual widgets. The app shell subscribes to the active borehole event stream and invalidates React Query caches when backend domain events arrive.

| File | Responsibility |
| --- | --- |
| `realtime/useWorkbenchRealtime.ts` | Opens the active-borehole SSE connection, reconnects after interruption, parses events, and invalidates query caches. |
| `realtime/workbenchRealtime.ts` | Maps domain events to query keys such as workbench, AI summary, export readiness, export jobs, and borehole list. |

The current UAT behavior is refresh-by-event: edits, imports, mobile submissions, validation, AI suggestions, layout changes, and export jobs publish events, then the frontend refetches canonical API data. Widgets do not own websocket/SSE logic.

Curve tracks can optionally use visible-depth window sample fetching through the track renderer setting `sampleSource: "visible-window"`. In that mode, the curve track asks the backend for samples within the current visible depth range plus boundary samples just outside the window. Realtime import/curve/source-file events invalidate the `curveSamples` cache prefix for the active borehole, so viewport windows refresh through the same query layer as the rest of the workbench.

Partial updates, visible-depth window subscriptions, image tile invalidation, or a SignalR/.NET gateway must connect above the same query/control-plane contracts without changing track renderers.

## Track Model

Every track follows this shape:

```text
TrackFrame
  -> receives BoreholeWorkbench, DisplayTrack, LogTrackContext
  -> applies the common headerHeight from LogTrackContext
  -> excludes the header from depth calculations
  -> track render model calculates visible objects, styles, labels, and SVG/canvas data
  -> React component renders track body from the model
  -> implements hitTest(depth, localX, localY)
  -> returns TrackObject
  -> central handler decides what the click/hover means
```

Track-specific calculations should live in pure render-model files where practical:

| Concern | Preferred Location |
| --- | --- |
| Visible interval filtering | `core/depthVisibility.ts` plus `<track>/<track>RenderModel.ts` |
| Renderer settings parsing | `core/rendererSettings.ts` |
| Pixel height, CSS style, label visibility, title text | `<track>/<track>RenderModel.ts` |
| SVG/canvas point preparation | `<track>/<track>RenderModel.ts` |
| DOM event depth mapping | `core/logWidgetControlPlane.ts`, `core/TrackFrame.tsx`, and fallback helper `core/trackPointerMapping.ts` |

This keeps React components thin and makes zoom/scroll/render behavior testable without opening the browser.

Current track renderers:

| Track | File | Purpose |
| --- | --- | --- |
| Depth | `tracks/depth/DepthTrack.tsx`, `depthRenderModel.ts` | Depth ticks and depth-axis hit testing. |
| Lithology | `tracks/lithology/LithologyTrack.tsx`, `lithologyRenderModel.ts` | Colored lithology intervals. |
| Seam | `tracks/seam/SeamTrack.tsx`, `seamRenderModel.ts` | Coal seam markers. |
| Recovery/RQD | `tracks/quantitativeBar/QuantitativeBarTrack.tsx`, `quantitativeBarRenderModel.ts` | Quantitative interval bar tracks. |
| Curves | `tracks/curve/CurveTrack.tsx`, `curveRenderModel.ts`, `curveHitTestModel.ts` | Multi-curve normalized curve rendering, hit testing, and tooltips. |
| Remarks | `tracks/remarks/RemarksTrack.tsx`, `remarksRenderModel.ts` | Grouped remarks to avoid clutter. |
| AI Suggestions | `tracks/aiSuggestions/AiSuggestionsTrack.tsx`, `aiSuggestionsRenderModel.ts` | Depth-aligned suggestion markers. |
| Images | `tracks/images/ImageTrack.tsx`, `coreImageRenderModel.ts`, `coreImageHitTestModel.ts` | Depth-aligned core image state, prepared rock-lane rendering, and image selection. |

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
- Track add/remove/reorder/clone
- Drag widgets directly to a grid location
- Resize widgets directly from the lower-right resize handle
- Right-click a widget to open widget settings
- Unsaved-change detection and compact editor summary chips

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
- optional interaction config for tooltip, context menu, and selectable behavior

`DisplayEditorDialog.tsx` owns the edit session. `DisplayRuntime.tsx` renders the saved display grid during runtime and delegates each widget to a file under `display/runtime/`. `displayEditorModel.ts` owns catalog/default/normalization helpers. `widgets/logWidget/LogWidget.tsx` uses the saved log widget settings to decide which track components to render.

For the final-pass UI management pattern, use [Workbench UI Management Architecture](workbench-ui-management.md). For the complete LogWidget architecture, use [LogWidget Architecture](log-widget.md). For the depth/scroll/zoom/click/ruler mathematics, use [Log Widget Control Plane](log-widget-control-plane.md).

Correlation-specific display helpers should stay under `workbench/correlation/`. For example, seam tie-line construction is kept in `correlationTieLines.ts` and tested separately from the React workspace so section/correlation rendering can change layout without losing the geological continuity rules.

## Adding A New Track

1. Add config defaults in `backend/app/domains/display_layouts/defaults.py`.
2. Add the TypeScript rendering component under `frontend/src/workbench/tracks/<track>/`.
3. Add `<track>RenderModel.ts` for visible filtering, style calculations, labels, and renderer-specific data.
4. Add unit tests for the render model.
5. Wrap the React component in `TrackFrame`.
6. Use `DepthScale`; do not write separate depth math.
7. Add a `hitTest`.
8. Register the track in `tracks/trackRegistry.tsx`.
9. Add the track to `trackCatalog.ts` if users should be able to re-add it.
10. Add behavior to `interactions.ts` only if click/hover/context-menu should do something new.

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
| Improve visual display | `widgets/logWidget/LogWidget.tsx`, track components, `styles.css` |
| Change click/hover behavior | `core/interactions.ts`, `TrackFrame.tsx`, track `hitTest` |
| Improve curve rendering | `core/curveMath.ts`, `tracks/curve/curveRenderModel.ts` |
| Improve display settings | `display/DisplayEditorDialog.tsx`, `display/displayEditorModel.ts`, backend layout defaults |
| Improve runtime display rendering | `display/DisplayRuntime.tsx`, `display/displayEditorModel.ts` |
| Add side-panel metadata | `App.tsx` right panel and backend workbench schema |
| Add AI workflow UI | `workbench/ai/AiWorkflowPanel.tsx`, `tracks/aiSuggestions` |
| Add export controls | `workbench/exports/ExportPanel.tsx` |
