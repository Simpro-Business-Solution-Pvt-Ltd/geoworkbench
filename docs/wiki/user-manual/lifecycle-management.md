# GeoWorkbench Lifecycle Management User Manual

GeoWorkbench is organized around a borehole lifecycle. A borehole is the central record that links field capture, uploaded Excel/LAS/PDF/image files, interpreted intervals, curves, displays, AI/rule insights, correction history, correlation, and export.

## 1. Borehole Management

Use the Dashboard to select an existing borehole or create a new one.

When creating a borehole, enter the borehole code, project/site, planned or known depth, and available collar details such as RL, UTM, coal-grid coordinates, water level, and coordinate system. These fields become the anchor for map display, correlation context, import merge, and export.

If no borehole is selected, Import Center will ask you to create or select one before uploading data. This avoids accidentally importing files into the wrong borehole.

## 2. Data Arrival And Import

Data can arrive through:

- Web uploads in Import Center.
- Registered file names for files already staged on the server.
- Field PWA/mobile submissions.
- Later template-based Excel/LAS import and merge workflows.

Import Center attaches every source file to a borehole. The source queue shows the file type, current status, next action, and audit facts. Use the template registry to review how source fields map into the GeoWorkbench data model.

For UAT, Excel lithology workbooks and LAS geophysical logs are the primary supported import paths. PDF geophysical signatures and corebox image processing are tracked as future/refinement workflows unless a validated extraction template is available.

## 3. Field PWA / Mobile Feed

The field workflow lets site users create or select a borehole, capture interval details, runtime parameters, remarks, and upload files or photos. These submissions sync to the central backend as field submissions and source files.

The central geologist can then review, merge, validate, and correct the borehole in the web workbench.

## 4. Display And Workbench

The workbench is a configurable display surface. Widgets can be arranged and saved per display. The LogWidget is the main interpretation workspace and includes depth, lithology, seams, recovery/RQD, curves, remarks, AI suggestions, and core image placeholders or processed image strips where available.

In runtime mode, right-click the log for actions such as zoom, full-depth reset, tooltip toggle, diagnostics, and runtime curve show/hide. Runtime curve visibility changes only the current review appearance; it does not alter the saved display configuration.

In display edit mode, use the widget library, inspector, and borehole explorer to refine layouts and LogWidget track composition. Save writes the display configuration. Cancel exits without keeping unsaved edits.

## 5. Correction And Interpretation

Rules and AI suggestions are decision support. They highlight possible depth gaps, interval conflicts, seam continuity questions, curve/lithology mismatches, and missing evidence. The central geologist reviews the suggestion and can override interval fields, remarks, RQD/recovery, seam metadata, and other supported properties.

Saved edits are versioned through correction audit records so raw/imported evidence and corrected interpretation can be discussed separately.

## 6. Correlation

Correlation compares selected boreholes side by side. Use it to review seam continuity, top and bottom depth alignment, thickness variation, missing picks, and available geophysical evidence. The reference borehole and focus seam controls help narrow the interpretation discussion.

Future refinement should use Reliance-provided geophysical signatures to improve automatic marker matching, curve-assisted seam interpretation, and AI explanation quality.

## 7. Export

Export Center prepares corrected data for downstream tools. The current UAT focus is Excel/CSV and LAS-compatible output. Export templates define which sections and fields are included.

Users with export permission can create exports directly. Import is more tightly controlled because it can change borehole state and interpretation consistency.

## 8. UAT Guidance

Recommended UAT path:

1. Create or select a borehole.
2. Upload or register Excel and LAS source files.
3. Process/import or merge the source data.
4. Open the workbench and review log visualization.
5. Run validation and AI suggestions.
6. Edit an interval and save the correction.
7. Use runtime curve visibility and zoom to inspect curve evidence.
8. Open correlation and compare seam top/bottom behavior.
9. Export corrected data.

Record issues with the borehole code, display name, source file, depth interval, and expected behavior.
