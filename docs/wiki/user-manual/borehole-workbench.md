# Borehole Workbench User Manual

Updated: 2026-07-06

This page describes the current GeoWorkbench UAT workflow for central geologists, data administrators, and reviewers. It covers the functionality implemented so far and calls out practical limits that should be understood before production deployment.

## Sign In And Navigation

Use the web application with a configured local or Entra-backed account.

Current demo users:

| User | Password | Role | Typical use |
| --- | --- | --- | --- |
| `geologist` | `geologist123` | System admin / central geologist | Full UAT review, settings, import/export, AI review |
| `field` | `field123` | Site geologist | Mobile and field workflow demonstrations |
| `developer` | `developer123` | Developer | Developer wiki and technical review |

After sign-in, the main navigation provides:

- **Dashboard**: select a borehole and choose the saved or default display.
- **Workbench**: review depth-indexed tracks, metadata, validation, and AI suggestions.
- **Import**: register/upload source files, process templates, and merge data.
- **Export**: review readiness, choose export formats, generate, and download files.
- **Correlation**: compare multiple boreholes, seams, curves, and depth/RL alignment.
- **Settings**: manage users, roles, access mapping, and quality rules.
- **Display setup**: configure the saved workbench layout, widgets, tracks, and curves.
- **Wiki**: open user, deployment, and architecture documentation.

The profile menu shows the signed-in user, role, theme/accent controls, logout, password change, and a diagnostics health card.

## Dashboard

The dashboard is the starting point for selecting a borehole.

1. Select a borehole card.
2. Choose **Saved display** to use the stored layout or **Default display** to use the system default.
3. Open the workbench, import center, export center, or display setup from the card actions.

Saved display choices, selected borehole, and unit/timezone preferences are remembered per user through the server profile, with browser storage kept as a local fallback for UAT/demo resilience.

## Workbench Runtime

Runtime mode is used by central geologists to inspect and correct borehole logs. It is depth-based: all visible tracks share the same virtual depth domain, visible depth interval, scroll, zoom, and ruler position.

Typical workflow:

1. Open a borehole in **Workbench**.
2. Scroll or zoom to the required depth.
3. Review lithology, seams, recovery/RQD, geophysical curves, remarks, AI markers, and image tracks.
4. Click or drag in the log area to move the red depth ruler.
5. Review the right-side depth metadata panel.
6. Open **Edit correction** when a lithology interval needs correction.
7. Run validation and generate AI review suggestions.
8. Accept, reject, or manually apply corrections after geological review.

### Depth Navigation

The log widget supports:

- Mouse wheel / trackpad scrolling.
- Zoom in and zoom out around the selected depth.
- Rectangular zoom by click-dragging a vertical depth interval.
- Full-depth reset from the context menu.
- Hover ruler and selected red crosshair.
- Right-click context actions for zoom and tooltip mode.

The depth ruler and metadata panel now resolve the interval at the selected depth, so the depth shown by the ruler and the interval shown in the metadata panel remain consistent.

### Tracks

The runtime display can include these track types:

| Track | Purpose |
| --- | --- |
| Depth | Depth ticks and labels. |
| Lithology | Color/pattern-coded lithology intervals. |
| Seam | Seam names and coal/local seam intervals. |
| Recovery | Recovery percentage or recovery length bars. |
| RQD | RQD percentage bars. |
| Curves | Gamma, resistivity, density, caliper, or other imported curves. |
| Remarks | Depth-linked remarks and grouped annotations. |
| Core images | Depth-aligned visual core/rock image lane. |
| AI suggestions | Open, accepted, and rejected AI/rule suggestion markers. |

Headers show configured track names, curve legends, units, and curve scales where available.

### Depth Metadata

The right metadata panel shows information for the selected depth or interval:

- Depth ruler value.
- Containing lithology interval.
- Lithology code and label.
- Source row.
- Thickness.
- Logged color.
- Seam.
- Recovery and RQD.
- Core box.
- Structural features and remarks.
- Source workbook/sheet information.

If a depth has no containing lithology interval, the panel reports that explicitly.

### Editing Corrections

Use **Edit correction** from the metadata panel to edit the currently displayed lithology interval. The editor supports:

- From depth and to depth.
- Lithology code and label.
- Logged color.
- Seam name.
- Recovery length and recovery percent.
- RQD percent.
- Structural features.
- Remarks.

Saving the editor updates the interval and records a correction audit entry.

## Corebox Image Track

The image track is intended to show depth-aligned corebox visual evidence beside lithology and curve tracks.

### Current UAT Image Flow

For PBH-62, original corebox tray photographs are processed into a single depth-ordered rock lane per core box. The preparation script is:

```powershell
backend\.venv\Scripts\python.exe backend\scripts\generate_core_rock_lanes.py --all --five-lane-from-box 74
```

The script:

1. Reads original corebox photographs from `MTSE-65(PBH 62)/`.
2. Detects the tray rows/lanes.
3. Crops the rock-bearing parts of each row.
4. Masks out much of the tray/ruler/background.
5. Rotates each lane into vertical depth order.
6. Stacks the lane crops top-to-bottom into one image per core box.
7. Writes preview and master JPEGs plus a manifest.

Generated local output:

```text
MTSE-65(PBH 62)/core-rock-lanes/PBH-62/manifest.json
MTSE-65(PBH 62)/core-rock-lanes/PBH-62/master/*.jpg
MTSE-65(PBH 62)/core-rock-lanes/PBH-62/preview/*.jpg
```

These generated files are intentionally ignored by git. They should be regenerated on the server or stored in MinIO/S3-compatible object storage, not committed to source control.

### Depth Calibration

The generated manifest stores calibrated depth ranges for each corebox image. PBH-62 uses workbook-derived lithology intervals linked by `image_box`, not a fixed equal-depth assumption.

Important examples:

- Box 1 is calibrated from `0.00 m` to about `5.40 m`.
- Boxes 1-73 are treated as four-lane trays in the current UAT preparation.
- Boxes 74-141 are treated as five-lane trays in the current UAT preparation.
- Box 141 ends around `604.30 m`.

The backend reads the manifest and exposes preview/master URLs and metadata to the frontend. The image track then chooses an overview, preview, or master image depending on zoom level and visible depth.

### How Corebox Images Should Be Imported In Production

The preferred production flow is:

1. Upload/register original corebox photos as source files.
2. Store originals in object storage such as MinIO/S3 under stable keys.
3. Run the rock-lane generation process on the server.
4. Store generated preview/master images and manifest in object storage.
5. Save source-file and core-image metadata in PostgreSQL.
6. Let the image track load images through backend asset URLs or controlled presigned URLs.

Recommended object key pattern:

```text
corebox/PBH-62/original/001.jpg
corebox/PBH-62/rock-lane/master/001.jpg
corebox/PBH-62/rock-lane/preview/001.jpg
corebox/PBH-62/rock-lane/manifest.json
```

## Validation

The workbench has deterministic validation rules for common borehole data issues:

- Invalid interval depths.
- Intervals outside borehole depth.
- Missing lithology codes.
- Missing lithology intervals.
- Gaps and overlaps.
- Recovery greater than interval thickness.
- RQD outside the 0-100% range.
- Coal/carbonaceous intervals without seam labels.
- Curves with no samples.
- Curve coverage mismatch.
- Missing core image links.
- Missing recovery or RQD data.
- Curve/lithology disagreement.
- Caliper washout warning.
- Core image depth mapping missing or conflicting.

Validation findings are shown in the validation panel and can be used by the AI suggestion workflow.

## AI Review And Summary

The AI panel currently combines deterministic rule-based suggestions with an optional local LLM summary.

Implemented behavior:

- Generate AI review from validation findings.
- Group curve coverage findings.
- Create suggested actions and, for selected cases, suggested correction patches.
- Accept or reject suggestions.
- Highlight suggestions in the AI suggestion track.
- Show an AI/provider status indicator.
- Produce a borehole summary using deterministic metrics and, when enabled/reachable, a local LLM.

Important: AI output is advisory. The geologist remains responsible for accepting, rejecting, or editing corrections.

## Quality Rule Configuration

Admins can configure quality behavior from **Settings -> Quality Rules**.

The page supports:

- Enable or disable each validation rule.
- Change rule severity: error, warning, or info.
- Enable or disable rule-based AI suggestions.
- Decide whether validation runs before AI suggestion generation.
- Group curve coverage findings.
- Choose which info-level findings can become AI suggestions.
- Configure AI summary behavior:
  - local LLM use
  - max rule findings
  - max tokens
  - temperature
  - geologist approval note
  - system prompt
  - user prompt template

These settings are stored in the database and are used by validation, AI suggestion generation, AI summary, and export approval checks.

## Import Center

The Import Center supports registering or uploading source files and processing them with saved profiles.

Current supported paths:

- Excel lithology interval imports.
- LAS geophysical curve imports.
- Geophysical PDF curve extraction as an evidence/digitization aid.
- Source file registration for images and other project files.
- Merge source data into the canonical borehole model.

Merge options include replacing overlapping intervals/curves or appending only new non-overlapping data. Source files remain visible for audit and review.

For template details, see **Import, Merge, And Export Templates** in the wiki navigation.

## Export Center

The Export Center supports readiness review and file generation.

Current supported exports:

- Corrected lithology Excel.
- Corrected lithology CSV.
- Curve LAS.
- Curve CSV.

Readiness checks consider validation errors/warnings, source data, curves, and open AI suggestions. Export readiness is advisory except where validation errors block approval. The UAT build does not yet implement a full maker-checker export approval workflow.

## Correlation View

The Correlation workspace shows multiple boreholes together for review. It supports:

- Multi-borehole display.
- Depth/RL alignment discussion.
- Seam and lithology comparison.
- Curve comparison.
- AI/insight narrative for correlation scenarios.

The current correlation dataset includes synthetic aligned boreholes for demonstration while customer-provided datasets are still being normalized.

## Display Setup

Display setup allows administrators or advanced users to configure the workbench layout.

Current capabilities:

- Select widgets shown in the display.
- Configure log widget tracks.
- Show/hide tracks.
- Configure curve tracks, colors, units, visibility, and scale ranges.
- Reset to the default display.
- Save a runtime layout per borehole.

Display setup changes visual layout only. It should not change geological data.

## User, Role, And Access Settings

System admins can manage:

- Local users.
- User activation/deactivation.
- Password reset.
- Roles.
- Role access mapping.

The current build includes database-backed users and bearer sessions. Full production RBAC enforcement can be deepened per route and feature after UAT.

## Future Agentic AI Opportunities

The current AI workflow is intentionally controlled: it summarizes, flags issues, and proposes actions for a geologist to approve. A future agentic AI layer can build on the same validation, import, image, and audit foundation to make the system more proactive while keeping human approval in the loop.

Possible future use cases:

- **Import review agent**: watch newly uploaded Excel, LAS, PDF, and image files; detect the best template; identify missing mappings; and prepare a merge checklist for the data administrator.
- **Borehole quality agent**: run validation, group related findings, prioritize critical depth intervals, and create a review queue for the central geologist.
- **Core image agent**: process uploaded corebox photographs, infer lane order and depth labels, flag low-confidence crops, and ask the geologist to approve the depth mapping before the image track is updated.
- **Curve/lithology interpretation agent**: compare gamma, resistivity, density, caliper, lithology, seam intervals, core images, and remarks; then suggest intervals that need closer review.
- **Correlation agent**: compare nearby boreholes, highlight seam continuity questions, detect depth/RL inconsistencies, and prepare a correlation discussion package.
- **Export readiness agent**: check open issues, unresolved AI suggestions, missing source evidence, and required customer fields before an export package is generated.
- **Audit explanation agent**: explain what changed between source import, correction, approval, and export so managers can review decisions without reading raw tables.

These agents should not silently overwrite geological interpretation. The recommended design is a supervised workflow where the AI prepares evidence, options, and confidence notes, and a qualified user approves any data change.

## Practical Limitations

This UAT build is usable for guided evaluation, but these limits should be understood:

- UI/UX is still being refined and should not be treated as final production design.
- Some template editors still expose technical JSON.
- Import merge preview is functional but not a full visual impact report.
- Validation rules are deterministic and configurable, but not yet customer-certified business rules.
- AI suggestions are mostly deterministic rule-based suggestions.
- Local LLM summary requires the configured local provider to be available.
- AI output must be reviewed and approved by a geologist.
- Corebox image generation currently uses dataset-specific assumptions for PBH-62 lane counts.
- Corebox image processing is not final computer-vision interpretation.
- Depth labels visible inside tray photos are not fully read and validated automatically.
- Generated rock-lane images are not stored in git; production should use object storage or server-side regeneration.
- Minex-specific export requires the customer's exact import template before finalization.
- Export readiness is not a full second-user approval workflow.
- User preferences are partly stored in browser local storage.
- Mobile/offline production behavior is still staged.

## Future Pending Work

Recommended next work items:

- Deploy production/staging server with PostgreSQL, backend, frontend, IIS reverse proxy, and MinIO/object storage.
- Move original and generated corebox images to MinIO/S3-compatible storage.
- Add server-side image generation jobs and job status tracking.
- Add confidence scoring and manual geologist approval for core image depth mapping.
- Improve computer vision for tray/lane detection, empty-space removal, depth-label reading, cracks, gaps, fractures, missing core, and low-confidence crops.
- Add a visual import merge impact report.
- Improve import/export template editors so admins do not need to edit raw JSON.
- Finalize customer-specific Minex export templates.
- Add production RBAC enforcement for every sensitive route/action.
- Add maker-checker approval where required by customer governance.
- Add PDF/report export.
- Add stronger audit screens for correction history and exported packages.
- Add object-storage backup/restore procedures.
- Add OpenTelemetry/dashboard monitoring.
- Complete mobile offline sync, token refresh, and push notification hardening.
- Continue performance optimization for very deep boreholes, many curves, and high-resolution image tracks.
