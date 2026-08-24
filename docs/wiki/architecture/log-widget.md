# LogWidget Architecture

Updated: 2026-08-24

This page is the main architecture reference for the GeoWorkbench LogWidget. It covers the widget structure, dynamic track and curve configuration, data-source discovery, rendering rules, editing flow, and extension contracts.

For the detailed depth mathematics and interaction invariants, use [Log Widget Control Plane](log-widget-control-plane.md).

## Purpose

LogWidget is the depth-based visualization engine inside GeoWorkbench. It must let a geologist build a borehole display from configurable tracks, curves, interval evidence, image evidence, remarks, and AI/rule suggestions without requiring code changes for every new borehole or LAS mnemonic.

The widget must support:

- multiple track types in one shared depth space.
- multiple curves in one curve track.
- any imported curve from a borehole data source.
- editable display settings persisted in the saved display layout.
- consistent click, hover, drag, zoom, ruler, and context-menu behavior.
- runtime rendering from saved settings.
- edit-mode configuration of tracks, curves, display settings, and interaction behavior.

## Core Principle

LogWidget configuration is data-driven.

Hardcoded track renderer types are allowed only at the renderer registry level. Hardcoded borehole-specific tracks or hardcoded curve names are not allowed.

For example:

- `curve` is a valid registered track type.
- `gamma` must not be a hardcoded required curve.
- `GR`, `NGAM`, `RHOB`, `SP`, or any unknown LAS mnemonic should appear as selectable curves when imported for the current borehole.
- Curve dictionary classification may suggest family, label, color, and unit, but it must not hide unmapped curves.

## Runtime Module Layout

```text
frontend/src/workbench/widgets/logWidget/
  LogWidget.tsx          -> widget shell, control-plane hook, track context, overlay state
  LogWidgetHeader.tsx    -> borehole title and track/curve count
  LogWidgetFooter.tsx    -> visible/domain depth, zoom controls, diagnostics toggle
  LogContextMenu.tsx     -> right-click actions using normalized depth/object context
  useElementHeight.ts    -> measured scroll container height
```

Shared core modules:

```text
frontend/src/workbench/core/
  logWidgetControlPlane.ts   -> virtual/visible depth, transforms, pointer resolution, diagnostics
  useLogWidgetControlPlane.ts -> React bridge to DOM scroll
  logTrackContext.ts         -> context passed to every track
  TrackFrame.tsx             -> common track header/body frame and event normalization
  depthDomain.ts             -> virtual depth inference and bottom padding
  depthScale.ts              -> depth/body coordinate scale
  logViewport.ts             -> pure viewport geometry
  logViewportController.ts   -> pure scroll/zoom transitions
```

Track modules:

```text
frontend/src/workbench/tracks/
  trackRegistry.tsx
  depth/
  lithology/
  seam/
  quantitativeBar/
  curve/
  remarks/
  images/
  aiSuggestions/
```

Display editor modules:

```text
frontend/src/workbench/display/
  trackCatalog.ts
  editor/LogWidgetSettings.tsx
  editor/CurveTrackSettings.tsx
  editor/QuantitativeTrackSettings.tsx
  editor/RemarksTrackSettings.tsx
  editor/SeamTrackSettings.tsx
```

## Runtime Tree

```text
DisplayRuntime
  -> RuntimeWidgetFrame
    -> LogWidget
      -> LogWidgetHeader
      -> lithology legend
      -> scroll container
        -> track row
          -> TrackFrame(depth)
          -> TrackFrame(lithology)
          -> TrackFrame(seam)
          -> TrackFrame(curve)
          -> TrackFrame(...)
          -> ruler / crosshair / rubber-band / context menu overlays
      -> LogWidgetFooter
```

Every track is rendered through `TrackFrame` or must follow the same contract.

## Header And Body Contract

Every visible track in one LogWidget instance shares the same header height.

`LogWidget.tsx` calculates the required header height from:

- default minimum header height.
- number of visible curves in curve tracks.
- explicit per-track header height overrides.

The resolved `headerHeight` is stored in `LogTrackContext`.

`TrackFrame.tsx` applies `context.headerHeight` directly to:

- the `.track-title` height.
- the `.track-body` top offset.

CSS may provide fallback styling, but CSS does not calculate geological geometry.

All depth calculations use the track body, not the full track and not the header. Pointer events from the header are ignored.

## LogTrackContext

Every registered track receives the same context:

```text
LogTrackContext
  data                 BoreholeWorkbench
  controlPlane         LogWidgetControlPlane
  scale                DepthScale
  headerHeight         number
  depthDomain          full virtual depth span
  visibleDepthSpan     current visible depth span
  widthForTrack(track) configured proportional track width
  dispatchTrackEvent   normalized event dispatcher
```

Track renderers must use this context instead of calculating global depth state.

## Display Settings Shape

LogWidget settings live inside the saved display layout:

```text
DisplayLayout.settings.widgets[widgetId]
```

The default display normally contains a primary log widget id:

```text
settings.widgets["log-widget"]
```

Additional/cloned LogWidget instances must store their own settings under their own widget id. Runtime rendering should pass the selected widget instance into `LogWidget` instead of relying on hardcoded borehole-specific settings.

The widget contains track configuration:

```json
{
  "type": "logWidget",
  "title": "Geology Log",
  "tracks": [
    {
      "id": "curves",
      "type": "curve",
      "title": "Curves",
      "visible": true,
      "width": 260,
      "header": {
        "visible": true,
        "showTitle": true,
        "height": 96
      },
      "interaction": {
        "tooltipEnabled": true,
        "contextMenuEnabled": true,
        "selectable": true
      },
      "renderer": {
        "sampleSource": "visible-window",
        "maxWindowSamples": 1000
      },
      "curves": []
    }
  ]
}
```

The display editor may clone widgets. A cloned LogWidget is a separate widget instance with its own tracks, curves, renderer settings, and interaction settings.

## Track Configuration

Each track has common settings:

| Field | Meaning |
| --- | --- |
| `id` | Unique id inside the widget. |
| `type` | Registered renderer type, such as `curve`, `lithology`, `seam`, `images`. |
| `title` | Header title shown in the track. |
| `visible` | Runtime visibility. |
| `width` | Relative width used to distribute the available LogWidget width. |
| `header` | Header visibility/title/height settings. |
| `interaction` | Tooltip, context menu, and selectable behavior. |
| `renderer` | Track-specific renderer settings. |

Track-specific settings are allowed, for example:

- `curves[]` for curve tracks.
- `valueField`, `unit`, `min`, `max`, `valueMultiplier`, `color` for quantitative tracks.
- renderer options such as remark grouping, label visibility thresholds, image display mode, sample windowing.

## Track Registry

`tracks/trackRegistry.tsx` maps a `DisplayTrack.type` to a renderer.

The registry is intentionally finite because each track type needs rendering and hit-testing logic. This is not the same as hardcoding data. It is acceptable to register track types such as:

- depth axis.
- lithology interval.
- seam interval.
- quantitative interval bar.
- geophysical curve track.
- remark group.
- core image track.
- AI suggestion track.

It is not acceptable to hardcode a curve mnemonic, borehole id, site code, or customer-specific Excel column into the renderer.

## Track Catalog

`display/trackCatalog.ts` defines which track types can be added from the LogWidget settings UI.

The catalog should describe capabilities:

```text
TrackCatalogItem
  id
  label
  category
  description
  create(availableCurves, existingIds)
```

The catalog creates a default configuration, not a fixed final display. Users can edit, remove, clone, reorder, resize, and hide tracks.

## Data-Source Discovery

The settings UI should build its addable content from the active borehole workbench payload.

Data sources currently available in `BoreholeWorkbench` include:

| Source | Used For |
| --- | --- |
| `curves[]` | Curve track selectable curves. |
| `lithology_intervals[]` | Lithology track and interval metadata. |
| `seam_intervals[]` | Seam track and correlation evidence. |
| `core_images[]` | Core image track and interval evidence panel. |
| `ai_suggestions[]` | AI suggestion track. |
| `validation_issues[]` | Validation/AI issue markers. |
| interval `attributes` | Recovery, RQD, remarks, water level, coordinates, extra geological fields. |
| borehole metadata | Header, single value widgets, interval panel, export scope. |

The UI should expose addable options based on what exists:

- If curves exist, curve tracks can add those curves.
- If interval numeric fields exist, quantitative tracks can map to those fields.
- If image evidence exists, image tracks can show it.
- If AI/rule suggestions exist, AI tracks can show them.
- If a source is missing, the track can still be added but should render a clear empty state.

## Curve Discovery

Curve selection must come from imported borehole curves:

```text
BoreholeWorkbench.curves[]
  id
  key
  label
  unit
  source_type
  color
  curve_metadata
  samples[]
```

The curve settings UI must show all curves for the current borehole. It should never be limited to a fixed list such as gamma/resistivity/density.

For each curve, the UI should show:

- source mnemonic from `curve_metadata` where available.
- display label.
- unit.
- source type, such as LAS, PDF extraction, synthetic, or mobile/imported.
- sample count and depth coverage where available.
- mapping status: mapped family, alias match, or custom/unmapped.

Unknown or unmapped curves remain selectable. The user can configure label, unit, color, visibility, tooltip, line style, and scale.

## Curve Dictionary

Curve dictionaries are advisory, not restrictive.

The dictionary can provide:

- suggested family.
- preferred display label.
- default unit.
- default color.
- mnemonic aliases.
- export mapping hints.
- rule/AI interpretation hints.

The dictionary must not block display of unknown curves. Unknown curves are displayed as custom curves and can be mapped by an administrator.

## Curve Track Configuration

A curve track can contain many curves:

```json
{
  "id": "curves",
  "type": "curve",
  "title": "Curves",
  "visible": true,
  "width": 260,
  "renderer": {
    "sampleSource": "visible-window",
    "maxWindowSamples": 1000,
    "minYPixelSpacing": 1.5
  },
  "curves": [
    {
      "curveKey": "NGAM",
      "label": "Natural Gamma",
      "unit": "API",
      "color": "#ef4444",
      "visible": true,
      "tooltipEnabled": true,
      "lineStyle": "solid",
      "scale": {
        "mode": "manual",
        "min": 0,
        "max": 750
      }
    }
  ]
}
```

Required curve settings:

| Setting | Meaning |
| --- | --- |
| `curveKey` | Link to `BoreholeWorkbench.curves[].key`. |
| `label` | Display name in the header and tooltip. |
| `unit` | Display unit. |
| `color` | Curve line color. |
| `visible` | Show/hide curve within the track. |
| `tooltipEnabled` | Include curve in tooltip. |
| `lineStyle` | Solid/dashed/dotted or custom style. |
| `scale.mode` | Manual or derived scale mode. |
| `scale.min/max` | Normalization range for this curve. |

Multiple curves can share one track even if their values have different units or ranges. Each curve is normalized independently into the same track real estate.

## Curve Scaling

Curve scaling must be per curve, not per track.

Supported scale concepts:

- manual min/max.
- auto from full curve.
- auto from visible window.
- reset to imported/default range.

The current UAT UI supports manual min/max and reset scale. The architecture requires the same persisted config shape to support additional scale modes without changing the renderer contract.

## Curve Sample Loading

Curve tracks support two sample sources:

| Mode | Meaning |
| --- | --- |
| `workbench` | Use samples already present in the workbench payload. |
| `visible-window` | Fetch samples for the visible depth window plus boundary samples. |

For larger boreholes, visible-window loading is the preferred runtime mode. The renderer must include samples just outside the visible window so curves do not look falsely broken at the top or bottom of the viewport.

## LogWidget Settings Page

The LogWidget settings page is opened from display edit mode.

It must support:

- add track from track catalog.
- edit track title, width, visibility, header height, tooltip, context menu, selectable behavior.
- remove track.
- clone track.
- reorder track.
- edit track-specific settings.
- for curve tracks, add/remove/reorder curves from active borehole curves.
- edit curve label, unit, color, min/max, scale mode, line style, visibility, tooltip behavior.
- preserve unsaved edit state until Save/Cancel.
- persist only when the user saves the display.

The settings UI must present available curves from the active borehole data source, not from a fixed hardcoded list.

## Add Track Flow

```text
Open Display Edit
  -> select or right-click LogWidget
  -> open LogWidget settings
  -> choose Add Track
  -> settings UI reads TrackCatalog
  -> create default track config
  -> if track type needs source data, bind selectable source from BoreholeWorkbench
  -> user saves display
  -> runtime LogWidget renders saved track config
```

## Add Curve Flow

```text
Open LogWidget settings
  -> select curve track
  -> settings UI reads BoreholeWorkbench.curves[]
  -> show all curves not already configured in that track
  -> user adds one or more curves
  -> default display config is derived from curve metadata/samples
  -> user adjusts label, unit, color, scale, visibility
  -> user saves display
  -> runtime curve track resolves curveKey to imported curve data
```

## Track Renderer Contract

Each track renderer must:

- receive `BoreholeWorkbench`, `DisplayTrack`, and `LogTrackContext`.
- use `context.scale` for depth-to-Y conversion.
- use `context.visibleDepthSpan` for filtering.
- use `context.controlPlane` only when it needs domain/viewport helpers.
- render inside `TrackFrame`.
- keep hit testing track-specific.
- return typed `TrackObject` values from hit testing.
- avoid setting global zoom, scroll, visible depth, or virtual depth.

## Interaction Contract

All track interaction events follow one normalized shape:

```text
TrackPointerEvent
  type
  trackId
  trackType
  depth
  localX
  localY
  object
  nativeEvent
```

`TrackFrame` resolves pointer depth from `.track-body` bounds through `controlPlane.resolvePointer(...)`.

The central interaction handler decides what click/hover/context menu means. Track renderers do not directly update unrelated UI panels.

## Empty State Contract

A track must handle missing data gracefully:

- curve track with no curves: show empty curve state.
- image track with no core images: show image-missing state.
- seam track with no seams: show empty seam state or no markers.
- quantitative track with missing field: show configured-field missing state.
- AI track with no suggestions: show empty suggestions state.

Missing data is a valid geological/data workflow condition, not a rendering error.

## Extending With A New Track Type

To add a new track type:

1. Define the source data contract.
2. Add or reuse canonical backend/API fields.
3. Add a track renderer under `frontend/src/workbench/tracks/<track>/`.
4. Add a pure render model for visible filtering and style calculations.
5. Add hit-test model where interaction is needed.
6. Add settings UI if the track has configurable behavior.
7. Register the renderer in `tracks/trackRegistry.tsx`.
8. Add the addable item to `display/trackCatalog.ts`.
9. Add unit tests for render model and settings helpers.
10. Update this wiki page if the contract changes.

## Extending With A New Curve Mnemonic

No renderer change is needed for a new LAS curve mnemonic.

The import flow should store the curve as:

```text
Curve.key
Curve.label
Curve.unit
Curve.source_type
Curve.curve_metadata.mnemonic
Curve.samples[]
```

The LogWidget settings page should show it as selectable automatically.

Optional administrator action:

- add mnemonic alias to the curve dictionary.
- set preferred family, label, unit, and color.
- map export naming.
- add rule/AI interpretation hints.

## Storage And Persistence

Display layout JSON stores the LogWidget configuration. Curve samples and interval data remain in canonical borehole tables/API payloads.

This separation is important:

- display settings say how to show data.
- canonical borehole data stores what the data is.
- import templates map external files into canonical data.
- export templates map canonical data out to external formats.

## Non-Negotiables

- Do not hardcode customer-specific curve names into LogWidget rendering.
- Do not hardcode a fixed curve list into settings.
- Do not calculate depth from CSS layout assumptions.
- Do not let a track renderer mutate global scroll or zoom.
- Do not hide unknown curves.
- Do not overwrite saved display settings without an explicit save action.
- Do not mix import mapping rules into display rendering code.
