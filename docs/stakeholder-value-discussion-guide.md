# GeoWorkbench Stakeholder Value Discussion Guide

## Discussion Theme

How can GeoWorkbench support the coal borehole lifecycle from field capture to corrected geological log, correlation, insights, and export into existing mining software?

The discussion should focus on business value for geologists: reducing manual effort, improving interpretation confidence, preserving traceability, and creating practical decision support from field data, Excel logs, LAS curves, corebox images, rules, visualization, and AI-assisted insights.

## 1. Input Data And Field Capture

Purpose: understand how geological and operational data reaches the system.

Discussion topics:

- What data is captured at site today: interval descriptions, recovery, RQD, seam markers, water level, coordinates, drilling status, remarks, photos, and corebox images.
- Whether data is captured continuously, per interval, shift-wise, daily, or after the full borehole is completed.
- Whether site geologists work online, offline, or in mixed connectivity.
- Whether they expect mobile forms, Excel uploads, LAS uploads, image uploads, or all of these.
- Whether mobile submissions should create a borehole first, append to an existing borehole, or remain as draft arrivals until central review.
- How batch and near-real-time data arrivals should be handled.

Business value:

- Reduces manual re-entry.
- Preserves field context.
- Enables central geologist review earlier instead of waiting for fully corrected sheets.
- Gives a clearer path from site capture to central interpretation.

## 2. Data Modeling, Import, Merge, And Storage

Purpose: define the canonical data model and how incoming data becomes usable geological evidence.

Discussion topics:

- What should be stored as the canonical borehole model: borehole header, interval data, lithology, seam, recovery/RQD, remarks, curves, core images, operational parameters, and audit history.
- How many versions are needed: raw field log, imported Excel log, AI/rule-suggested log, geologist-corrected log, and approved export log.
- Whether imports should create a new borehole, append to an existing borehole, merge with existing data, compare differences, or create a correction layer.
- Whether import templates should be maintained per customer, site, vendor, software, or spreadsheet type.
- How conflicts should be shown when mobile forms, Excel, LAS curves, and corrected data disagree.

Business value:

- Gives traceability across correction steps.
- Supports multiple correction stages without overwriting evidence.
- Makes import/export configurable instead of one-off.
- Creates a defensible review history for the corrected borehole log.

## 3. Corebox Image Handling

Purpose: understand how corebox photos can become useful visual evidence in the borehole display.

Discussion topics:

- What image formats they can provide: full tray images, box images, individual core run images, mobile photos, or scanned archives.
- Whether depth labels are written on the tray/box image or available separately in Excel.
- Whether they expect manual depth mapping, AI-assisted mapping, or full automatic extraction.
- Whether the system should show the original corebox image, cropped core runs, or a vertically reconstructed rock column.
- What level of AI assistance is acceptable: tray/lane detection, core crop suggestion, depth mapping suggestion, fracture/coal band identification, or visual anomaly detection.

Business value:

- Allows visual inspection beside lithology, remarks, and curves.
- Helps validate field descriptions during correction.
- Improves confidence when lithology, recovery, and curve response do not fully agree.

Positioning:

- For demo: show a vertically stacked core image track as a concept.
- For production: design a confirmed workflow for image import, depth mapping, AI-assisted crop/segment suggestion, and geologist approval.

## 4. Geophysical Logs And Curve-Based Insights

Purpose: connect LAS/PDF geophysical curves with corrected borehole logs.

Discussion topics:

- Which curves are typically available: gamma, density, resistivity, caliper, SP, sonic, deviation, or others.
- Whether LAS files are normally available, or whether teams often only receive PDF exports.
- What depth reference is used and how often curves need depth shifting or alignment.
- Whether curves help validate lithology boundaries, coal seams, washouts, bad recovery zones, or questionable remarks.
- Which curve-derived insights are useful: seam indicators, anomalous gamma response, missing coverage, bad hole condition, curve-depth mismatch, or curve/log inconsistency.

Business value:

- Makes the system more than a log viewer.
- Helps central geologists review inconsistencies faster.
- Creates explainable suggestions instead of black-box AI.

## 5. Visualization Workspace And Widgets

Purpose: define each widget with a clear geological purpose and make displays configurable for different review needs.

Discussion topics:

- Which widgets matter most:
  - Borehole log widget.
  - Curve track widget.
  - Lithology interval widget.
  - Remarks and metadata panel.
  - Core image preview and full image viewer.
  - AI/rule suggestion widget.
  - Import/export status widget.
  - Correlation widget.
- What should be configurable:
  - Tracks.
  - Curves.
  - Curve colors and ranges.
  - Track widths.
  - Header display.
  - Tooltips.
  - Visible depth range.
  - Units.
  - Saved display templates per user, project, or site.
- Whether they need different displays for field review, central correction, correlation, export approval, and management summary.

Business value:

- Reduces clutter.
- Lets geologists work in their preferred layout.
- Makes the product adaptable across coal blocks, teams, and review stages.

## 6. Rules And AI Insights

Purpose: separate deterministic validation from AI-assisted interpretation and summaries.

Discussion topics:

- Rules that should run automatically:
  - Missing depth intervals.
  - Overlapping intervals.
  - Recovery greater than run length.
  - RQD inconsistencies.
  - Missing seam markers.
  - Curve coverage gaps.
  - Suspicious lithology transitions.
- AI assistant opportunities:
  - Summarize borehole condition.
  - Explain validation findings.
  - Suggest intervals needing review.
  - Compare field log, Excel, LAS, and core image evidence.
  - Generate review checklist for central geologist.
- Approval behavior:
  - Should AI suggestions be accepted, rejected, and commented on?
  - Should accepted suggestions directly change data or create correction proposals?
  - Should every AI/rule decision be auditable?

Business value:

- Faster review.
- Explainable quality control.
- Keeps geologist in control.
- Supports a human-in-the-loop correction workflow.

## 7. Correlation Display

Purpose: discuss the highest-value interpretation workflow beyond single borehole correction.

Discussion topics:

- What they correlate today: seams, formations, lithology, coal bands, marker beds, geophysical signatures, or quality zones.
- Whether correlation is done by measured depth or RL/elevation.
- What spatial information is required: collar coordinates, borehole spacing, section line, grid, or deviation survey.
- Whether the display should show multiple boreholes side by side with seam/formation lines.
- Whether AI/rules should suggest seam continuity, missing markers, or misaligned markers.
- What decisions correlation supports: seam continuity, reserve estimation, quality zoning, drilling planning, and geological confidence.

Business value:

- Moves GeoWorkbench from single borehole correction to geological interpretation.
- Supports planning and validation.
- Gives a strong reason to use the platform beyond import/export.

## 8. Export And Integration

Purpose: ensure GeoWorkbench complements existing mining software and downstream workflows.

Discussion topics:

- Which tools they use today: Minex, Pinnacle, Surpac, Datamine, Vulcan, Excel workflows, internal databases, or other systems.
- Which formats are required: Excel, CSV, LAS, Minex-compatible import files, PDF reports, or database handoff.
- What should be exportable:
  - Raw data.
  - Corrected log.
  - Curves.
  - Seam markers.
  - Lithology intervals.
  - Core image references.
  - AI/rule review summary.
  - Approval status and audit details.
- Whether export settings should be saved as reusable templates.

Business value:

- Avoids vendor lock-in.
- Complements existing mining software.
- Makes corrected data usable downstream.
- Supports a complete capture-review-correct-export lifecycle.

## Suggested Stakeholder Questions

1. What are the top three activities where central geologists spend the most time during borehole correction?
2. Which mistakes are most costly if missed?
3. What data do you trust most when Excel, curves, and core images disagree?
4. Is correlation done after every borehole, at campaign level, or only during modeling?
5. Which current software must GeoWorkbench complement, not replace?
6. What would make this system valuable enough to use daily?
7. What data should be mandatory before a borehole can be approved for export?
8. Which insights should be rules-based, and which can be AI-assisted?
9. How should corrections be tracked across field, central review, and final approval?
10. What would make the corebox image workflow useful enough for routine geological review?

## Positioning Statement

GeoWorkbench can be positioned as a configurable geological review workspace that collects field data, imports existing logs and curves, organizes them into a traceable borehole model, assists correction using rules and AI, visualizes lithology, curves, core evidence, and metadata, supports multi-borehole correlation, and exports approved data to downstream mining software.

## Desired Outcome From Discussion

By the end of the stakeholder discussion, we should understand:

- Their real input sources and arrival patterns.
- The required canonical borehole data model.
- The import, merge, correction, approval, and export expectations.
- Which visualization widgets provide daily value.
- Which insights should be deterministic rules versus AI-assisted suggestions.
- What correlation workflows matter most.
- Which existing software and formats must be supported.
- What would make GeoWorkbench a useful production system rather than only a prototype.
