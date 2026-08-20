# Reliance Coal Geology Data Request

## Purpose

GeoWorkbench is being built as a web and mobile assistant for coal geologists. The mobile app supports field data collection, while the web app supports central review, borehole visualization, analytics, AI-assisted workflows, seam correlation, import/export, and final geological data preparation.

To mature the solution beyond demo/random data, we need Reliance to share real, NDA-covered datasets. The goal is not only to display boreholes, but to build a reliable geological workflow with source traceability, validation, correction history, AI learning, and export-ready outputs.

## Recommended First Delivery

For the first real pilot, Reliance should provide 10-20 complete boreholes from one coal block, where possible with matching collar data, lithology intervals, seam picks, geophysical logs, core photos, coal quality samples, dictionaries, and final approved corrections.

For AI learning and stronger seam correlation, we should later request 50+ historical approved boreholes, and eventually 100-300+ boreholes with paired geophysical logs and approved geological labels.

## How To Explain This To Reliance

We are not asking only for one Excel sheet of lithology data. We are asking for the full borehole data lifecycle, because the product needs to support how geologists actually work from field planning to final approved interpretation.

For each borehole, there may be several stages of data:

1. **Planned borehole data** - where the borehole was planned, planned depth, planned location, target seam/formation, and exploration objective.
2. **Actual drilling data** - what happened in the field: actual collar, final depth, drilling runs, recovery, RQD, water observations, drilling issues, and runtime notes.
3. **Raw field log** - the first lithology/geointerval log recorded by the site geologist or logging team.
4. **Cleaned or corrected log** - the central geologist's reviewed version after fixing gaps, overlaps, inconsistent codes, recovery/RQD issues, seam names, and depth adjustments.
5. **Final approved interpretation** - the version used for correlation, modelling, reports, and export to downstream mining/geology software.

We need these stages separately because GeoWorkbench should preserve the raw source, show what was corrected, record who corrected it, and learn from those corrections over time. If raw and corrected data are mixed together, the AI cannot learn properly and the geologist cannot audit the decision history.

For correlation, one borehole is not enough. We need multiple boreholes from the same locality or coal block, because seam continuity, seam split/merge behavior, fault offsets, thickness trends, and missing seams can only be understood across neighbouring boreholes. A good first correlation package would be 10-20 boreholes from one block. A stronger package would be 50+ approved historical boreholes from the same or related localities.

For AI, we need even more data. A useful AI model needs many examples where the input data and the approved answer are both available. For example:

- geophysical curves plus approved lithology labels
- raw field log plus central corrected log
- core image depth mapping plus approved lithology
- seam picks plus final correlation decisions
- coal quality samples linked to seams and intervals

The AI should not be trained only on raw field logs. It should learn from geologist-approved interpretations and correction history, because those represent Reliance's accepted geological judgment.

## Do Mining Companies Usually Have This Data?

Yes, mature mining and exploration companies normally have most of this data, but it is often distributed across many systems and formats rather than one clean database.

Typical locations are:

- Excel borehole logs and lithology sheets
- LAS geophysical log files from logging contractors
- PDF composite logs and geological reports
- core photo folders with separate depth mappings
- coal quality lab spreadsheets and PDFs
- seam correlation tables or modelling software exports
- GIS folders with collars, block boundaries, faults, and sections
- Minex, MinePlan, Surpac, Vulcan, Datamine, or similar modelling/planning software
- SharePoint, network drives, document repositories, or old project folders

So the request is realistic. The challenge is usually not whether the data exists, but whether the right files can be gathered, matched by borehole ID, and shared with enough metadata to make them usable.

Public coal-data standards and exploration deliverable lists support this structure. CoalLog, for example, covers coal borehole header, drilling, lithology, water flow, geotechnical, and quality data. MECL's public exploration deliverables include borehole logs/lithologs, geological maps and cross-sections, geophysical interpretation reports, analytical reports, and resource statements.

## Regular Data Inputs For GeoWorkbench

For day-to-day use of our application, Reliance does not need to provide all 14 dataset categories every time. Those 14 categories describe the full mature data ecosystem. The regular product workflow should be simpler.

The regular input to GeoWorkbench should be:

| Regular Input | Who Provides It | How It Enters The App | Insights The App Can Produce |
|---|---|---|---|
| Planned borehole details | Planning / central geology team | Web app or Excel import | Shows planned vs actual depth/location, tracks drilling progress, links field data to the correct borehole. |
| Actual drilling run data | Site geologist / drilling team | Mobile app or Excel import | Recovery %, RQD warnings, missing run data, drilling progress, core loss/washout review areas. |
| Raw field lithology / geointerval log | Site geologist | Mobile app or Excel import | Depth log visualization, lithology summary, interval gaps/overlaps, missing codes, missing seam names, first-pass geological search. |
| Core photos with depth/box mapping | Site geologist / core shed team | Mobile camera upload or image folder import | Core image track, visual evidence beside intervals, image-depth mismatch warnings, future image AI. |
| Geophysical logs | Logging contractor / central geology team | LAS import preferred; CSV/PDF fallback | Gamma/density/resistivity tracks, curve-lithology mismatch warnings, coal candidate intervals, seam top/base review evidence. |
| Central corrections and approvals | Central geologist | Web review/edit workflow | Raw vs corrected comparison, audit trail, export readiness, AI learning from geologist decisions. |
| Seam picks / correlation updates | Central geology / modelling team | Web correlation workspace or Excel import | Seam continuity review, missing seam warnings, split/merge/fault discussion, multi-borehole correlation. |
| Coal quality sample results | Lab / quality team | Excel/CSV import | Seam quality summaries, ash/GCV/moisture trends, quality outliers, future quality prediction. |

In simple terms, the normal application flow is:

```text
Planned borehole
  -> actual drilling runs and field observations
  -> raw lithology/geointerval log from mobile or Excel
  -> core photos and geophysical logs
  -> central geologist correction and approval
  -> seam correlation, AI insights, analytics, and export
```

## Minimum Data Needed To Demonstrate Real Value

If Reliance wants to see immediate value from the current application, the minimum useful package is:

1. **Borehole master data** for 10-20 boreholes from the same block/locality.
2. **Raw lithology/geointerval logs** for those boreholes.
3. **Actual drilling run/recovery/RQD data** for those boreholes.
4. **Final corrected or approved logs** for at least some of those boreholes.
5. **Seam picks/correlation table** for the same boreholes.
6. **Geophysical LAS logs** for as many of those boreholes as available.
7. **Core photos with box-depth mapping** for at least a few boreholes.
8. **Lithology and seam dictionaries** used by their geologists.

With this, GeoWorkbench can show:

- depth-based borehole visualization
- raw vs corrected interval review
- recovery/RQD and interval validation
- AI/rule suggestions with source evidence
- curve-lithology comparison
- seam correlation across nearby boreholes
- export readiness for corrected data

## Data Needed For AI Versus Daily Operations

There are two separate needs:

| Need | Data Required | Volume |
|---|---|---|
| Daily operational use | Current boreholes, field logs, drilling runs, core photos, LAS files, corrections, approvals. | Per active borehole or block. |
| Correlation and analytics | Multiple boreholes from the same locality with seam picks, lithology, logs, and quality data. | 10-50+ boreholes. |
| AI model learning | Historical approved boreholes with raw inputs and final geologist-approved labels/corrections. | Ideally 100-300+ boreholes over time. |

The application can deliver useful rule-based insights with a small dataset. But stronger AI suggestions need many historical examples, especially examples where we can compare the raw field version with the final corrected geological interpretation.

## Data Requested

| No. | Dataset | What Reliance Should Provide | Preferred Format | Purpose |
|---:|---|---|---|---|
| 1 | Project, block, and borehole master data | Project/block name, borehole ID, alternate IDs, collar coordinates, RL/elevation, total depth, drilling dates, status, drilling method, contractor, site geologist, coordinate system. | Excel or CSV. GIS layer if available. | Creates the master identity layer for imports, mobile submissions, maps, borehole selection, correlation, and exports. |
| 2 | Raw descriptive lithology / geointerval logs | Original field or central-office lithology logs with from depth, to depth/thickness, lithology code/text, color, grain size, recovery, RQD, structural features, core dip, seam name, remarks, source row. | Original Excel preferred; CSV accepted. | Core dataset for log widget, interval editing, validation, AI review, reporting, and corrected export. |
| 3 | Drilling run and recovery data | Run-wise drilling intervals, run length, recovered length, recovery %, bit/core size, date, driller notes, core loss notes, caving/washout remarks. | Excel or CSV. | Helps validate recovery/RQD, separate drilling runs from lithology intervals, and support field-to-central reconciliation. |
| 4 | Seam intervals, markers, and correlation picks | Seam name, top depth, base depth, thickness, partings, split/merge flags, confidence, correlation status, related boreholes, approved marker names. | Excel or CSV. Export from Minex/other modelling software if available. | Required for seam track, multi-borehole correlation, seam continuity checks, missing seam detection, and downstream modelling exports. |
| 5 | Geophysical logs | Raw depth-indexed logs such as gamma, density, resistivity, caliper, SP, sonic, inclination, azimuth, null values, units, logging date, contractor, tool metadata, depth shifts. | LAS preferred. CSV accepted. PDF only as fallback evidence. | Enables curve tracks, curve/lithology mismatch checks, coal candidate detection, seam top/base review, and AI-assisted interpretation. |
| 6 | Core image files and depth mapping | Original core box/tray photos with borehole ID, box number, image file name, from/to depth, lane/row count, image order, capture date, depth labels, mapping confidence. | JPG/PNG images plus Excel/CSV manifest. | Links visual evidence to intervals, supports core image track, and prepares future image AI for coal/fracture/missing-core detection. |
| 7 | Coal quality assay and sample data | Sample ID, borehole ID, sample from/to depth, seam name, sample type, lab report, basis, ash, moisture, volatile matter, fixed carbon, sulfur, GCV/NCV, HGI, washability if available. | Excel or CSV. Lab PDFs as supporting files. | Enables coal quality analytics, seam quality summaries, outlier checks, reporting, and future quality prediction. |
| 8 | Approved geological reports, sections, and plans | Final geological reports, lithologs, seam correlation charts, structure/floor contours, cross-sections, maps, annexures, resource statements, report templates. | PDF/DOCX plus editable source files where available. | Builds the AI knowledge assistant, validates report output expectations, and provides source-linked context for summaries. |
| 9 | Spatial and GIS layers | Block boundary, lease area, borehole collars, topography, faults, lineaments, roads, pits, villages, drainage, DEM, section lines, coordinate reference system. | GeoPackage preferred; SHP, GeoJSON, DXF/DWG accepted. | Supports maps, mobile offline context, collar validation, section selection, spatial trend analysis, and correlation views. |
| 10 | Geotechnical, hydrogeology, gas, and runtime field parameters | RQD details, fractures/defects, point load/UCS, water level/flow, gas/desorption if available, ROP, torque, bit depth, hole depth, drilling observations. | Excel or CSV. Mobile form export if available. | Matures mobile capture and supports geotechnical, hydrogeological, drilling-condition, and safety-related analytics. |
| 11 | Dictionaries, aliases, units, and workflow rules | Lithology codes, seam aliases, color/pattern standards, unit conventions, sample types, quality basis values, correction stages, approval statuses, role/workflow rules. | Excel or CSV. | Prevents wrong normalization, makes import/export repeatable, and creates Reliance-specific geological vocabulary for AI and correlation. |
| 12 | Import/export target templates and downstream software examples | Current Reliance input templates, corrected output templates, Minex/Surpac/other modelling import formats, required columns, naming conventions, null handling, sample successful imports. | Original XLSX/CSV templates and example exports. | Finalizes Import Center and Export Center so generated data can move into Reliance workflows without manual reshaping. |
| 13 | Human correction and feedback history | Before/after interval corrections, accepted/rejected AI or rule suggestions, changed by, timestamp, reason, source evidence, reviewer comments, final approval status. | Excel, CSV, or database export. | Creates the learning loop. Geologist corrections become the most valuable customer-specific AI training and audit dataset. |
| 14 | Production, model, and quality reconciliation data | Planned model seam/block data, actual mined quantities, actual quality, stockpile/dispatch quality, block/bench/date identifiers, variance notes. | CSV, Excel, or database export. | Later-stage dataset for mature analytics: model-vs-actual reconciliation, quality variance, planning feedback, and management dashboards. |

## Important Notes

- Raw source files should be preserved separately from cleaned or corrected data.
- Every row should include borehole ID and source file reference wherever possible.
- Units and coordinate systems must be clearly stated.
- Unknown lithology or seam names should not be silently changed; they should be flagged for dictionary review.
- PDF geophysical logs are useful, but LAS or CSV curve data is much better for production.
- Core photos are useful only when depth mapping is confirmed or clearly marked as inferred/pending.
- AI training should use approved final interpretations, not unreviewed raw logs.
