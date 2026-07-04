# Import, Merge, And Export Templates

This page is for admin/product users who configure project templates. Geologists can use the saved templates without editing JSON.

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

### LAS Template

```json
{
  "depth": "DEPT",
  "curves": ["GR", "NGAM", "RES", "RHOB", "CAL"],
  "alias_policy": "map_common_mnemonics"
}
```

LAS import preserves all valid samples. Display optimization can be added later without dropping source data.

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
5. Approve readiness if required.
6. Generate and download.

## Export Template Editing

Export templates map canonical fields to output columns or sections.

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
