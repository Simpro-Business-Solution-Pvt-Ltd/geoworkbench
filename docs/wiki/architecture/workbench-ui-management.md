# Workbench UI Management Architecture

Updated: 2026-08-24

This page defines the final-pass direction for GeoWorkbench UI management. It covers how users discover borehole data, add data to LogWidget, add widgets to displays, open floating settings windows, and save or discard configuration changes.

Related pages:

- [LogWidget Architecture](log-widget.md)
- [Log Widget Control Plane](log-widget-control-plane.md)
- [Frontend Architecture](frontend-architecture.md)

## Direction

GeoWorkbench should use one consistent interaction model:

```text
select borehole + select display
  -> open floating tools
  -> drag data/widgets into a display surface
  -> configure through floating settings windows
  -> preview immediately
  -> save, save as, undo, cancel, or discard
```

The application should not have separate one-off patterns for LogWidget, dashboard, import/export widgets, and correlation. The user should learn one model and reuse it everywhere.

## First Target: LogWidget

The first implementation target is LogWidget because it is the core geology visualization widget.

Final-pass LogWidget goals:

- stable control-plane behavior for virtual depth, visible depth, scroll, zoom, click, drag, tooltip, context menu, and ruler.
- clean module boundaries under `widgets/logWidget/`.
- all track rendering through `TrackFrame`.
- all track/curve configuration stored in display layout JSON.
- Borehole Explorer as the source of available borehole data.
- drag/drop from Borehole Explorer into LogWidget.
- floating LogWidget settings window.
- dynamic curves from imported borehole data, not hardcoded curve names.

## Second Target: Display And Widget Platform

After LogWidget, the same pattern should be applied to the whole display.

Final-pass display goals:

- Widget Library as a floating source palette.
- drag/drop widgets from Widget Library to the display grid.
- drag/resize widgets directly on the grid.
- right-click widget to open settings.
- floating widget settings windows.
- widget settings are structured by widget type.
- display save/undo/cancel/save-as is consistent with LogWidget edits.
- widget library entries are registry-driven, not hardcoded inside the editor component.

## Floating Tool Model

The UI should use floating, movable windows for advanced tools rather than permanent heavy sidebars.

Core floating tools:

| Tool | Purpose |
| --- | --- |
| Borehole Explorer | Discover current borehole data and drag data into LogWidget or other widgets. |
| Widget Library | Discover available widgets and drag widgets into dashboard/workbench/correlation surfaces. |
| Display Settings | Edit display name, grid, defaults, unit set, and display-level preferences. |
| Widget Settings | Edit selected widget settings. |
| LogWidget Settings | Edit tracks, curves, interactions, renderer options. |
| Curve Settings | Edit curve-specific label, unit, color, scale, style, tooltip. |
| Track Settings | Edit track title, width, header, renderer, interaction options. |

Floating windows should support:

- move.
- resize where useful.
- minimize/collapse.
- close.
- focus/z-index behavior.
- remember position per user where practical.
- keyboard escape to close if no unsaved changes.

Floating windows should not be modal unless the action is destructive or requires confirmation.

## Selected Context

The current workbench context is:

```text
project/site context
selected borehole
selected display
selected user/preferences
```

Borehole Explorer is scoped to the selected borehole.

Widget Library is scoped to the selected workspace/display type. For example:

- dashboard widgets.
- workbench widgets.
- correlation widgets.
- import/export widgets.

If the selected borehole changes:

- Borehole Explorer refreshes its tree.
- LogWidget re-resolves data using the new borehole payload.
- saved display selection should remain if compatible, otherwise fall back to default.

If the selected display changes:

- Display surface renders that layout.
- Borehole Explorer remains scoped to the same borehole.
- Widget Library remains scoped to the workspace.

## Borehole Explorer

Borehole Explorer is the data-source palette for the selected borehole. It should be a floating/dockable tree view with expand/collapse nodes.

Recommended tree:

```text
Borehole Explorer
  Metadata
    Collar
    Coordinates
    Water level
    Runtime parameters
  Intervals
    Lithology
    Seam
    Recovery
    RQD
    Remarks
    Custom fields
  Geophysical Logs
    Curves
      <curve mnemonic/key>
  Images
    Core images
    Core strips
    Field photos
  Quality And AI
    Validation issues
    AI suggestions
    Correction versions
```

Explorer interactions:

| Action | Behavior |
| --- | --- |
| Expand/collapse | Shows or hides child nodes. |
| Search/filter | Finds curves, fields, remarks, images, and suggestions. |
| Click node | Shows details/metadata preview. |
| Double-click node | Adds with default placement. |
| Drag node | Starts typed drag payload. |
| Right-click node | Shows actions such as add, view metadata, map mnemonic, export field. |

Explorer nodes should be generated from the active `BoreholeWorkbench` payload and canonical metadata. They should not be coded as customer-specific lists.

## Widget Library

Widget Library is the source palette for display widgets.

It should be registry-driven:

```text
WidgetCatalogItem
  type
  label
  icon
  description
  defaultSize
  supportedSurfaces
  permissions
  dataRequirements
  createDefaultSettings(context)
  settingsEditor
  renderer
```

Current widget types can evolve into this model:

- single value.
- LogWidget.
- AI workflow.
- interval details.
- curve catalog.
- validation.
- interpretation queue.
- evidence coverage.
- correlation.
- import summary.
- export readiness.

Widget Library interactions:

| Action | Behavior |
| --- | --- |
| Drag widget | Adds widget to display grid at drop position. |
| Click widget | Adds widget to default location. |
| Search/filter | Finds widgets by purpose. |
| Category filter | Groups operational, geology, AI, import/export, dashboard, correlation widgets. |
| Right-click widget type | Shows description/default settings. |

## Display Surface

A display surface is a configurable grid that holds widgets.

Display surface responsibilities:

- render saved widget grid.
- support edit mode.
- support drag/drop from Widget Library.
- support widget move/resize.
- support widget selection.
- support right-click widget settings.
- support display-level save/undo/cancel.
- preserve layout as `DisplayLayout.settings`.

The display surface should not contain widget-specific logic. It should delegate to:

- widget registry.
- settings editor registry.
- display grid utilities.
- floating window manager.

## Edit Mode And Runtime Mode

The UI should support both runtime exploration and explicit edit mode.

| Mode | Purpose | Persistence |
| --- | --- | --- |
| Runtime | Geologist reviews data and temporarily explores additional layers/widgets. | No silent save. User can save preview to display. |
| Edit | User deliberately configures display/widget layout and settings. | Draft changes persist only on Save. |

Runtime changes should show an unobtrusive state:

```text
Temporary display changes
Save to display | Save as new display | Discard
```

Edit mode should show:

```text
Unsaved changes
Undo | Cancel | Save display
```

## Floating Settings Windows

Every configurable object should use the same floating settings window pattern.

Settings window hierarchy:

```text
Display Settings
  Widget Settings
    LogWidget Settings
      Track Settings
        Curve Settings
```

The same framework can render different settings bodies:

```text
FloatingSettingsWindow
  title
  targetType
  targetId
  position
  size
  dirty state
  body renderer
  footer actions
```

Settings windows should work with draft state. They should not mutate server state directly.

## Draft State Model

All display and widget edits should follow one draft model:

```text
source saved display
  -> normalized draft
  -> command/update
  -> history stack
  -> preview render
  -> save/cancel/undo
```

Commands should be pure where practical:

- add widget.
- remove widget.
- clone widget.
- move widget.
- resize widget.
- patch widget settings.
- add track.
- remove track.
- clone track.
- reorder track.
- add curve.
- remove curve.
- patch curve settings.

This keeps behavior testable and prevents one-off UI mutations.

## Drag Payloads

Use typed payloads for drag/drop.

Examples:

```json
{ "scope": "borehole", "kind": "curve", "curveKey": "NGAM" }
{ "scope": "borehole", "kind": "intervalNumericField", "field": "rqd", "unit": "%" }
{ "scope": "widgetLibrary", "kind": "widget", "widgetType": "logWidget" }
{ "scope": "display", "kind": "existingWidget", "widgetId": "log-widget" }
```

Drop targets must validate payloads before applying changes.

## Drop Resolvers

Drag/drop should not directly change React component internals. It should go through pure resolver functions.

Suggested resolver modules:

```text
display/widgetDropResolver.ts
display/logWidgetDropResolver.ts
display/trackConfigFactory.ts
display/widgetConfigFactory.ts
explorer/explorerDragPayload.ts
```

Resolver responsibilities:

- validate payload.
- identify target mode.
- decide add/update behavior.
- generate default config.
- return a draft patch/command.
- report ambiguity if user choice is needed.

## Permissions

Permissions should apply consistently:

| Permission | Controls |
| --- | --- |
| View borehole | Open Borehole Explorer and display existing data. |
| Edit display | Add/remove/resize widgets, tracks, and curves. |
| Save shared display | Persist changes to shared display. |
| Save personal display | Persist user-specific display copy. |
| Manage dictionaries | Map curve mnemonics, units, and families. |
| Edit interpretation | Save geological corrections/observations. |

Runtime exploratory drops should be allowed only if the user can view the data. Persisting those drops requires display-save permission.

## Recommended Implementation Order

### Step 1: Finish LogWidget Foundations

- Ensure LogWidget accepts a widget instance directly instead of relying on canonical `log-widget` remapping.
- Keep `widgets/logWidget/` as the only LogWidget module.
- Keep `LogTrackContext` as the single track context.
- Keep control-plane diagnostics available.
- Verify all track renderers use `TrackFrame`.

### Step 2: Borehole Explorer Read Model

- Build pure `boreholeExplorerModel.ts`.
- Generate metadata, interval, curve, image, quality, and AI nodes from `BoreholeWorkbench`.
- Include search labels, counts, units, mapping status, and availability.
- Unit-test the tree model.

### Step 3: Floating Borehole Explorer UI

- Add floating explorer window.
- Add expand/collapse tree.
- Add node details preview.
- Add typed drag payloads.

### Step 4: LogWidget Drop Resolver

- Add pure resolver for dropped explorer payloads.
- Support curve to curve track.
- Support curve group to new/existing curve track.
- Support numeric interval field to quantitative track.
- Support image/AI/lithology/seam layers.
- Unit-test resolver outcomes.

### Step 5: Floating LogWidget Settings

- Convert LogWidget settings into floating settings window pattern.
- Keep track/curve settings grouped and searchable.
- Ensure settings update draft state only.

### Step 6: Widget Library

- Extend widget catalog metadata.
- Add floating Widget Library window.
- Support drag/drop widgets to display grid.
- Unit-test widget config factories.

### Step 7: Unified Display Editor

- Apply same floating window framework to display settings and widget settings.
- Keep full-page editor as the editing surface, but avoid heavy permanent sidebars.
- Add consistent save/undo/cancel/save-as behavior.

### Step 8: Polish And Manual UAT

- Check at desktop zoom levels.
- Check no overlap in floating windows.
- Check runtime exploratory drops do not silently save.
- Check edit-mode changes persist only on Save.
- Check permissions and disabled states.

## Non-Negotiables

- One UI management pattern across LogWidget, display grid, and widget settings.
- Floating tools for explorer/library/settings rather than overloaded permanent panels.
- Drag/drop payloads must be typed and resolved through pure functions.
- Runtime mode must not silently persist configuration changes.
- Edit mode must support undo/cancel/save.
- Widgets must be registry-driven.
- Curves and interval fields must be discovered from borehole data.
- Settings windows must mutate draft state, not backend state directly.

