# Canonical Data Model And Exchange Strategy

GeoWorkbench should not treat each Excel, LAS, PDF, mobile form, or image upload as a separate one-off data shape. Every source should be transformed into a stable canonical model, reviewed, merged, and then exported through target-specific templates.

## Core Principle

```text
Source file or mobile batch
  -> parser/adapter
  -> import mapping template
  -> canonical borehole model
  -> validation and geologist correction
  -> export mapping template
  -> target file/package
```

The import/export capability becomes valuable only when this middle model is consistent.

## Canonical Storage Groups

### Project Hierarchy

- `Project`
- `Site`
- `Borehole`

These hold block/site/borehole identity, workflow status, total depth, source workbook, and high-level metadata.

### Geological Intervals

- `LithologyInterval`
- `SeamInterval`
- `CorrectionAudit`
- `ValidationIssue`
- `AiSuggestion`

Intervals are depth ranges. They keep common fields as columns, such as from/to depth, lithology, seam, recovery, RQD, structural features, and remarks.

Extra source-specific fields should go into:

- `LithologyInterval.attributes`
- `SeamInterval.attributes`

Examples:

```text
grain_size
core_dip
rqd_piece_lengths
original_lithology_source
site_observation_code
correction_stage
confidence
```

Frequently queried fields can later be promoted from `attributes` into real columns.

### Depth-Series Curves

- `Curve`
- `CurveSample`

This is the right model for LAS and other geophysical logs:

- one `Curve` per mnemonic/log
- many `CurveSample` rows per depth/value pair
- composite index on `curve_id, depth`
- curve metadata in `Curve.curve_metadata`

The system should import all valid samples. Performance should be handled by query windows, caching, downsampled display tiles, or server-side curve pyramids later, not by silently dropping source data.

### Core Images

- `CoreImage`

Current core image records hold box number, source file, and depth range. `CoreImage.image_metadata` stores processing metadata such as:

```text
original asset details
tray/lane crop coordinates
strip image path
rotation
scale
AI detection confidence
geologist confirmation status
fracture/missing-core annotations
```

The next mature image model should split this further:

- `ImageAsset`: original uploaded/captured file
- `CoreBoxImage`: box/tray-level image record
- `CoreImageSegment`: depth-mapped crop/strip segment
- `ImageAnnotation`: fracture, missing core, cracks, boundaries, confidence

For the current stage, `CoreImage.image_metadata` gives us a clean extension point.

### Source And Provenance

- `SourceFile`
- `SourceImport`
- `ImportProfile`

These preserve where data came from, how it was parsed, which template was used, and what merge happened.

### Mobile Capture

- `FieldSubmission`

Mobile submissions remain flexible JSON batches. Runtime parameters should be captured as name/value/unit records inside the payload until stable field requirements are confirmed.

Example:

```json
{
  "depth_from": 186.0,
  "depth_to": 191.5,
  "runtime_parameters": [
    { "name": "Bit depth", "value": 191.5, "unit": "m" },
    { "name": "Hole depth", "value": 191.7, "unit": "m" },
    { "name": "Water level", "value": 18.4, "unit": "m" }
  ]
}
```

## Import Mapping Strategy

Import templates should describe how source data maps into canonical paths.

Examples:

```text
Excel F -> lithology.from_depth
Excel G -> lithology.thickness
Excel I -> lithology.lithology_code
Excel O -> lithology.attributes.core_dip
LAS NGAM -> curve.gamma
LAS 16N -> curve.resistivity_16n
Mobile runtime parameter "Bit depth" -> field_submission.payload.runtime_parameters[]
Corebox crop lane 1 -> core_image.image_metadata.strip_processing.lanes[0]
```

Template capabilities should include:

- source type
- sheet/table detection
- header rows
- data start/end detection
- canonical field mappings
- required/optional fields
- unit conversions
- enum/dictionary normalization
- merge policy
- validation rules

## Export Mapping Strategy

Export templates should map canonical data out to target formats:

- Excel corrected log
- CSV interval tables
- LAS curve files
- PDF review package
- Minex-compatible CSV/ASCII once their exact target template is confirmed

Export profiles should include:

- borehole scope
- correction stage: raw, field submitted, central corrected, approved final
- depth range
- included entities: intervals, seams, curves, core image metadata, AI suggestions, audit
- column order
- unit settings
- null/blank handling
- target naming conventions

## Workbench Boundary

The Workbench display is for visualization, correction, AI review, and geologist sign-off.

Import and export are separate lifecycle centers:

- Import Center: register source, detect template, preview, validate, merge.
- Export Center: choose scope, choose format, check readiness, approve, generate.

Data exchange should not be a draggable log-display widget. This keeps the user flow intuitive and avoids mixing operational ingestion with interpretation display.

## Performance Rules

- Store depth-series data normalized: `Curve` plus `CurveSample`.
- Index by `curve_id, depth`.
- Query visible depth windows for interactive display.
- Keep original source file records for audit/re-import.
- Do not silently cap imported samples.
- Add display caching/downsampling later as an explicit rendering optimization, not as source data loss.

## Current Gaps To Close

- Editable import template designer.
- Editable export profile designer.
- Proper image asset/segment/annotation tables.
- Curve unit conversion registry.
- Merge policy editor: append, replace, correction-stage merge, conflict review.
- Display query windowing for very large curve sets.

## Exchange Format Position

The reliable near-term formats for the Reliance demo are:

- Excel/XLSX for corrected lithology and interval logs.
- CSV for interval tables and curve tables.
- LAS for geophysical curves.
- Geophysical PDF import as a fallback when raw LAS/CSV is unavailable.

PDF export should be treated as a report/print package later, not as a primary data exchange format.

Minex-specific export should wait for a customer-provided import template or sample. Public product workflows around borehole systems commonly use CSV/XLS-style borehole imports, and older Minex workflow references also point to collar/lithology/geophysics loading through tabular data and LAS-style curve data. We should therefore prepare configurable CSV/XLS exports first, then tune column names, sections, and dictionaries to the exact Minex setup they use.

WITSML should stay future/optional. It is mainly an Energistics oil-and-gas well log exchange standard, and available tooling focuses on LAS-to-WITSML conversion. For coal geology, CoalLog is a more relevant data-standard reference than WITSML.
