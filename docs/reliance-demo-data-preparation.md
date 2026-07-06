# Reliance Demo Data Preparation

This runbook prepares a repeatable first-run dataset for the Reliance review server. It covers the current system flow: customer Excel templates, LAS geophysical curves, mobile-style interval submission, prepared core image strips, and synthetic multi-borehole correlation data.

## What Gets Prepared

- Customer-shared Excel workbooks are imported into the canonical borehole model.
- Customer-shared LAS curves are profiled and merged into curve storage.
- The original LAS file is preserved as a source file; display curves are sampled for practical UI performance.
- PBH-62 corebox tray images are converted into depth-ordered strip images for the core image track.
- Five synthetic correlation boreholes are generated with aligned Excel, LAS, core image, seam, and rule/AI insight scenarios.
- A mobile-style interval submission is attached to imported boreholes to demonstrate field-to-central sync.
- A manifest is written to `runtime-data/demo-prep/reliance-demo-manifest.json`.

## Command

From the repository root:

```powershell
backend\.venv\Scripts\python.exe backend\scripts\prepare_reliance_demo_dataset.py
```

The script is safe to rerun for demo refreshes. It reseeds the synthetic correlation block and updates the registered source files.

## Inputs Used

- `DOC-20260510-WA0000..xlsx`
- `DESCRIPTIVE LITHOLOGY CTSJ-30 (P-02) Running.xlsx`
- `CTSJ-02 P-27 COMPOSITE.las`
- `MTSE-65(PBH 62)/` corebox images
- Generated files under `sample-data/demo-coal-block/boreholes/`

The CTSJ LAS is merged into the CTSJ imported borehole for workflow demonstration only. The manifest records that the LAS and Excel alignment has not been confirmed as the same borehole.

## Storage Model

The import adapters feed the same canonical model used by the workbench:

- `Borehole`
- `LithologyInterval`
- `SeamInterval`
- `Curve`
- `CurveSample`
- `CoreImage`
- `SourceFile`
- `SourceImport`
- `FieldSubmission`

This gives us a clean story for import/export templates: templates map source columns or source curves into the canonical model, and export settings choose which canonical entities are emitted to Excel, CSV, LAS, or downstream mining packages.

## LAS Handling

LAS import reads `~WELL`, `~CURVE`, and `~A` sections and maps common mnemonics:

- `NGAM`, `GR`, `GAMMA` -> Natural Gamma
- `16N`, `64N`, `RES`, `SPR` -> Resistivity family
- `LSD`, `DENS`, `RHOB` -> Density
- `CAL` -> Caliper
- `SP` -> Spontaneous Potential
- `INC` -> Inclination
- `AZIM` -> Azimuth
- `TT_*`, `PDEL`, `SVEL` -> Sonic family

For performance, the importer stores a display-ready sampled set, capped by `max_samples_per_curve`, while preserving the original source file record for audit and future exact reprocessing.

## Corebox Images

For the first server run, PBH-62 corebox images are processed by `backend/scripts/generate_core_rock_lanes.py`. It crops the rock surface bands, masks non-rock pixels, rotates the lane crops, stacks them in depth order, and writes JPEG assets for the image track:

```text
MTSE-65(PBH 62)/core-rock-lanes/PBH-62/manifest.json
MTSE-65(PBH 62)/core-rock-lanes/PBH-62/master/*.jpg
MTSE-65(PBH 62)/core-rock-lanes/PBH-62/preview/*.jpg
```

The PBH-62 source set contains both four-row and five-row trays. The repeatable demo-prep path passes `--five-lane-from-box 74`, so boxes 1-73 are prepared as four-lane trays and boxes 74-141 are prepared as five-lane trays. The generated manifest records the resolved `lane_count`, crop-window source, master image, preview image, and calibrated depth range for each box.

Core image depth calibration is taken from the workbook-derived lithology intervals linked by `image_box`. This keeps the image track aligned with real logged depths such as box 1 at `0.00-5.40 m`, box 140 at `596.90-602.70 m`, and box 141 ending at `604.30 m`, instead of relying on the obsolete equal-4m-per-box mapping.

This is a code-assisted preparation step, not final geology-grade image interpretation. The next AI-assisted version should:

- Confirm tray/lane boundaries without dataset-specific hints.
- Detect depth labels or box ranges.
- Split core lanes into ordered rock intervals.
- Flag cracks/fractures, missing core, washed zones, and low-confidence crops.
- Ask the geologist to confirm the inferred depth mapping before committing the image track.

## Server First Run

1. Configure the external Postgres connection in `.env`:

```text
GEOWORKBENCH_DATABASE_URL=postgresql+psycopg://postgres:postgres@<host>:5432/geoworkbench
```

2. Start the backend once so `init_db()` creates tables, or run the prep script directly.

3. Run:

```powershell
backend\.venv\Scripts\python.exe backend\scripts\prepare_reliance_demo_dataset.py
```

4. Confirm `runtime-data/demo-prep/reliance-demo-manifest.json` exists.

5. Open the web app and verify:

- PBH-62 customer-style borehole display.
- CTSJ imported borehole with LAS curves.
- DMBH-01 to DMBH-05 correlation display.
- Source files visible in Import Center.
- Core Images track for PBH-62.

## Demo Talking Point

The prepared data intentionally separates two cases:

- Customer source files, where alignment may be incomplete and should trigger import/template/data-quality discussion.
- Synthetic aligned boreholes, where we can demonstrate the value of correlation, rule validation, AI insight generation, and export readiness without waiting for a perfect customer dataset.
