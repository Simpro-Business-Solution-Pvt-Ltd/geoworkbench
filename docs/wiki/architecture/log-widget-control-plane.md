# Log Widget Control Plane

Updated: 2026-08-24

This page defines the control-plane contract for GeoWorkbench depth-based visualization. The goal is to make the LogWidget accurate and consistent under zoom, scroll, click, drag, right-click, realtime refresh, and future track types.

The design is inspired by mature geology log controls such as INT/GeoToolkit style separation:

- domain state is owned by one control model.
- renderers receive resolved transforms and draw only their own objects.
- interactions convert display coordinates back to domain coordinates through the same transform.
- settings/configuration influence behavior, but do not calculate global viewport state.

## Core Rule

CSS may lay out containers and style graphics, but CSS must not be the source of geological truth.

The control plane owns:

- virtual depth domain.
- visible depth window.
- scroll state.
- zoom state.
- depth-to-pixel and pixel-to-depth transforms.
- track header/body coordinate separation.
- pointer event normalization.
- ruler/crosshair depth.
- rubber-band zoom depth range.
- context-menu depth/object.
- renderer invalidation when data changes.

Track renderers own:

- filtering their own objects to the visible depth span.
- converting their own values to x/width/color/style.
- drawing track-specific graphics.
- hit-testing track-specific objects using the control-plane depth and local track coordinates.

## Terminology

| Term | Meaning |
| --- | --- |
| Virtual depth | Full depth domain covered by the log widget. It must remain stable during scroll/zoom. |
| Visible depth | Current depth window visible in the track body. It changes with scroll and zoom. |
| Content height | Scrollable body height for the virtual depth domain at the current zoom scale. |
| Header height | Non-depth display area above the track body. It is excluded from all depth calculations. |
| Body coordinate | Pixel coordinate inside the scrollable track body, not including header. |
| Viewport coordinate | Pixel coordinate inside the currently visible body area. |
| Depth scale | Bidirectional transform between depth and body coordinate. |
| Value scale | Track-specific transform between curve/value domain and x coordinate. |

## Required Invariants

These invariants should be unit-tested and manually verified.

| Invariant | Expected behavior |
| --- | --- |
| Virtual depth stability | Zoom, scroll, hover, click, drag, and right-click never change virtual depth. |
| Realtime data expansion | Virtual depth changes only when borehole data/layout changes enough to change the real domain. |
| Visible depth consistency | Scroll changes visible depth start/end but preserves visible span at the same zoom. |
| Zoom consistency | Zoom changes pixels-per-depth and visible span, but preserves virtual depth and full scroll reach. |
| Bottom reach | After zooming, scrolling to max always reaches virtual depth bottom plus configured padding. |
| Header exclusion | Pointer depth is calculated only from track body bounds, never from header pixels. |
| Round-trip transform | `depth -> y -> depth` returns the same depth within tolerance. |
| Shared pointer mapping | Click, hover, drag, rubber-band zoom, ruler, and context menu use the same pointer mapping. |
| Renderer isolation | Track renderers do not calculate global virtual/visible depth. |
| Curve continuity | Curve render models include boundary/interpolated samples so visible-window curves are not falsely broken. |

## Current Modules

| Module | Responsibility |
| --- | --- |
| `depthDomain.ts` | Infer virtual depth from borehole data and visible tracks; add bottom padding. |
| `logViewport.ts` | Resolve viewport state from virtual depth, container height, header height, scale, and scroll. |
| `logViewportController.ts` | Pure transition model for scroll, zoom-at-depth, rubber-band zoom, and reset. |
| `logWidgetControlPlane.ts` | Public facade for virtual depth, visible depth, transforms, scroll/zoom transitions, pointer resolution, and diagnostics. |
| `useLogWidgetControlPlane.ts` | React bridge between the control plane and DOM scroll position. |
| `useLogViewportController.ts` | Compatibility adapter over `useLogWidgetControlPlane.ts` for older callers. |
| `depthScale.ts` | Bidirectional depth/body-coordinate transform using D3 scale utilities. |
| `TrackFrame.tsx` | Shared track frame, header exclusion, control-plane pointer normalization, event dispatch. |
| `trackPointerMapping.ts` | Convert client coordinates into track-local and depth coordinates. |
| `trackInteractionPolicy.ts` | Central policy for tooltip, context menu, and selectable behavior. |
| track render models | Track-specific visible filtering, styles, values, hit-testing helpers. |

## Target Public Contract

Introduce a small public facade named `LogWidgetControlPlane` so future code consumes one stable contract instead of combining lower-level utilities directly.

```text
LogWidgetControlPlane
  domain:
    virtualDepth
    visibleDepth
    bottomPadding

  geometry:
    containerHeight
    headerHeight
    bodyHeight
    contentHeight
    scrollTop
    maxScrollTop
    pixelsPerDepth

  transforms:
    depthToBodyY(depth)
    bodyYToDepth(y)
    depthToViewportY(depth)
    viewportYToDepth(y)
    intervalToBodyStyle(fromDepth, toDepth)

  interactions:
    resolvePointer(clientX, clientY, trackBodyBounds)
    zoomAtDepth(depth, factor, viewportY)
    zoomToDepthWindow(fromDepth, toDepth)
    scrollTo(scrollTop)
    resetFullDepth()

  diagnostics:
    invariantSnapshot()
    roundTripDepth(depth)
```

React components should receive this facade or a narrowed context derived from it. Track renderers should not know how scrollTop or contentHeight are computed.

## Event Flow

### Scroll

```text
browser scrollTop
  -> controlPlane.scrollTo(scrollTop)
  -> visibleDepth changes
  -> virtualDepth remains unchanged
  -> renderers receive new visibleDepth and same virtualDepth
```

### Wheel Zoom

```text
wheel with zoom modifier
  -> resolve pointer depth from body bounds
  -> controlPlane.zoomAtDepth(depth, factor, viewportY)
  -> pixelsPerDepth changes
  -> scrollTop recalculated to keep pointer depth anchored
  -> virtualDepth remains unchanged
```

### Rubber-Band Zoom

```text
drag start
  -> pointer depth A
drag move
  -> pointer depth B, draw rectangle from body coordinates
drag end
  -> controlPlane.zoomToDepthWindow(min(A,B), max(A,B))
  -> visibleDepth becomes requested depth window
  -> virtualDepth and max scroll reach remain intact
```

### Click / Right Click

```text
event target
  -> ignore if inside track header
  -> resolve pointer depth and local track coordinate
  -> renderer hitTest returns object at that depth/x/y
  -> interaction policy decides whether event is allowed
  -> workbench store receives normalized event
```

## Curve Control

Curve tracks have two independent control planes:

- depth/y control from LogWidgetControlPlane.
- value/x control from curve value scale.

Rules:

- Curve min/max can be auto-derived from all loaded samples, visible-window samples, or manual configuration.
- Auto-derived min/max must be deterministic and stored as renderer state/config only when the user saves settings.
- Display normalization is per curve, allowing multiple curves to share one track real estate.
- Visible-window rendering should include samples just outside the visible depth, plus interpolated edge samples where useful.
- Hit testing should search visible/nearby samples using the same rendered model when possible.

## Realtime Data Refresh

Realtime import/edit events should invalidate data, not mutate renderer-local state directly.

```text
backend event / query invalidation
  -> workbench data refresh
  -> virtual depth recomputed from new data
  -> if existing visible window still fits, preserve it
  -> if data expands below current bottom, keep current visible window and extend max scroll
  -> if selected depth/object no longer exists, clear or re-resolve selection
```

## Implementation Phases

### Phase 1: Formalize Control Facade

- Add `logWidgetControlPlane.ts`.
- Wrap existing viewport/controller/scale modules without changing renderer behavior.
- Add invariant tests for virtual depth, visible depth, zoom, scroll, header exclusion, and round-trip transforms.

### Phase 2: Route LogWidget Through The Facade

- `LogWidget.tsx` receives viewport state from `useLogWidgetControlPlane.ts`.
- `TrackFrame.tsx` resolves click, hover, drag, and context-menu depth through the shared control plane.
- Track renderers continue to receive resolved scale/visible-depth context and do not own global viewport math.

### Phase 3: Browser Geometry Hardening

- Add runtime diagnostics that show virtual depth, visible depth, scrollTop, maxScrollTop, content height, body height, header height, pixels/m, and pointer depth.
- Verify CSS assumptions: `.track-scroll`, `.track-row`, `.track-title`, `.track-body`.
- Add defensive checks when measured body bounds diverge from control-plane geometry.

### Phase 4: Curve Scale Maturity

- Add explicit curve scale mode:
  - manual.
  - auto-full-curve.
  - auto-visible-window.
- Keep min/max visible in the track header.
- Add tests for multi-curve normalization and boundary continuity.

### Phase 5: Realtime And Edit Refresh

- Preserve visible window during interval/curve/core-image refresh.
- Re-resolve selected interval/image/remark/suggestion after data changes.
- Add event-driven invalidation tests where possible.

## Non-Negotiables

- No track renderer may set global visible depth or virtual depth.
- No interaction may compute depth from page coordinates without going through the control plane.
- No CSS-only change should alter geological coordinate behavior.
- No zoom mode should reduce the virtual scrollable depth.
- Any future map-style core image tiling must consume the same visible-depth contract.
