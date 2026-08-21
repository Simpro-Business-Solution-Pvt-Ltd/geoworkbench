# Import, Merge, And Export Templates

This page is for admin/product users who configure project templates. Geologists can use the saved templates without editing JSON.

## UAT Position

This build is ready for controlled UAT and stakeholder exploration of the import, merge, and export workflow. The goal is to let users experience the flow and provide refinement suggestions.

Known UAT caveats:

- UI/UX is still being refined and should be treated as a working product preview, not final visual design.
- Import/export templates are editable, but the editor is still technical JSON for this phase.
- Import merge preview is functional but not yet a full visual impact report.
- Export readiness is a quality checklist, not a second-user approval workflow.
- Minex-specific export needs the customer's exact target import template before finalization.
- Geophysical PDF import should be treated as an evidence/digitization aid; LAS/CSV remains the preferred raw curve source.

## Import Flow

1. Open **Import Center**.
2. Register or upload a source file.
3. Click **Process** to detect/profile the file.
4. Click a template to review or edit its mapping.
5. Click **Merge** and confirm the merge options.

## Import Template Editing

Each import template stores a mapping JSON. The common examples are:

### Excel Lithology Template

```json
{
  "template_key": "ctsj_descriptive_v1",
  "data_start_row": 9,
  "lithology": {
    "from_depth": "F",
    "thickness": "G",
    "recovery": "H",
    "lithology_code": "I",
    "rqd_percent": "M",
    "structural_features": "N",
    "core_dip": "O",
    "seam_name": "P",
    "remark": "Q"
  }
}
```

Extra fields can be mapped into interval attributes by using an agreed field name in the mapping. Frequently used fields can later become first-class columns.

Imported interval rows are tagged with provenance metadata such as `data_stage`, `stage_source_type`, and `stage_source_name`. The current Excel import stage is `raw_imported` unless a customer-specific corrected-data template explicitly changes that behavior in a later release.

### LAS Template

```json
{
  "depth": "DEPT",
  "curves": ["GR", "NGAM", "RES", "RHOB", "CAL"],
  "curve_dictionary": {
    "gamma": ["NG", "NGAM", "GR", "GAMMA", "CGR", "SGR"],
    "resistivity": ["RS", "RES", "RESD", "RESS", "HRD", "SPR", "16N", "64N"],
    "density": ["DENS", "DEN", "RHOB", "LSD"]
  },
  "alias_policy": "map_common_mnemonics"
}
```

LAS import preserves all valid samples. Display optimization can be added later without dropping source data.

The curve dictionary is used to classify source mnemonics into canonical families for display, analytics, validation, and export. Unknown mnemonics are still imported as curves and are shown as unmapped until an admin updates the template/dictionary.

Imported curves keep the source mnemonic, source filename, and data stage in curve metadata so export templates and future analytics can separate LAS curves from PDF-digitized or derived/demo curves.

## Merge Choices

### Excel / Interval Sources

- **Replace overlapping depth range**: removes existing interpreted intervals in the selected depth range, then inserts the incoming intervals.
- **Append only new depth rows**: inserts incoming rows only where they do not overlap existing intervals.

Use replace when a corrected interval section arrives. Use append when field data arrives in new depth ranges.

### LAS / PDF Curve Sources

- **Replace curves with same key**: replaces existing curves such as `gamma` or `resistivity` when the incoming source has the same curve key.
- **Append only new curves**: creates curves that do not already exist and skips duplicate curve keys.

Use replace when a better or corrected LAS arrives. Use append when the source contains additional curves.

### Images

Images are stored as source files first. They become depth-linked core images after depth mapping or core-strip processing.

## Export Flow

1. Open **Export Center**.
2. Choose format: corrected Excel, corrected CSV, curve LAS, or curve CSV.
3. Choose the export template.
4. Edit the template if needed.
5. Review readiness checks.
6. Generate and download.

Export is permission-driven in this UAT build. A user with export access can generate exports directly. Readiness checks highlight quality issues, warnings, source availability, curve availability, and open AI/rule suggestions so the user can decide whether the package is fit for handover.

The generated export job should be treated as the audit point: it records what was exported, using which format/template and scope. A future production workflow can add maker-checker approval, stakeholder notifications, and export lock rules if the customer requires stronger governance.

## Export Template Editing

Export templates map canonical fields to output columns or sections.
The selected export template is used by the backend when generating the export file.

Example:

```json
{
  "sheet": "Corrected Lithology",
  "columns": [
    { "source": "borehole.code", "target": "Borehole" },
    { "source": "lithology.from_depth", "target": "From Depth" },
    { "source": "lithology.to_depth", "target": "To Depth" },
    { "source": "lithology.lithology_code", "target": "Lithology Code" },
    { "source": "lithology.remark", "target": "Remarks" }
  ]
}
```

## Supported Formats For First Phase

- Excel import/export for lithology intervals.
- CSV export for lithology intervals and curves.
- LAS import/export for curves.
- Geophysical PDF import for extracting curves when LAS is unavailable.

PDF export/reporting and Minex-specific templates should be added after receiving the customer’s exact target format.

## Working Without A Minex Template

Until the customer provides the exact Minex import template, use the default corrected Excel/CSV exports as an interchange layer:

1. Export corrected lithology to Excel or CSV.
2. Confirm required columns for their Minex workflow: borehole code, from depth, to depth, lithology code, seam, recovery, RQD, remarks.
3. Rename/reorder columns in an export template to match the expected Minex import sheet or CSV.
4. Save that export template and reuse it for future boreholes.

For geophysical curves, use LAS export. The LAS export template can restrict curves by adding:

```json
{
  "curves": ["gamma", "resistivity", "density"],
  "curve_dictionary": {
    "gamma": ["NGAM", "GR", "GAMMA"],
    "resistivity": ["RES", "RS", "SPR"],
    "density": ["DENS", "RHOB"]
  }
}
```

If `curves` is omitted or empty, all curves stored for the borehole are exported.
