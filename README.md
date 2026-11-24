# GeoWorkbench

GeoWorkbench is an AI-assisted geological workflow platform concept, initially focused on coal mine borehole interpretation, lithology support, seam correlation, data quality checks, and geological reporting.

New to the repository? Start with [PROJECT_ONBOARDING_GUIDE.md](PROJECT_ONBOARDING_GUIDE.md) for the implemented architecture, data model, user flows, setup, Reliance restore process, development conventions, and current limitations.

Manual UAT guides:

- [PWA_MANUAL_TESTING_GUIDE.md](PWA_MANUAL_TESTING_GUIDE.md) - install and test the Field PWA from first launch through central-workbench verification.
- [IMPORT_FEATURE_MANUAL_TESTING_GUIDE.md](IMPORT_FEATURE_MANUAL_TESTING_GUIDE.md) - test upload, parsing, mapping, import, merge, audit, validation, and failure cases.

The goal is not to replace geologists. The goal is to give geologists a practical workspace where data can be imported, visualized, interpreted, corrected, and gradually improved using AI and human feedback.

## Initial Product Direction

GeoWorkbench starts as a borehole interpretation workspace for coal geology:

- Import borehole, lithology, seam, and geophysical log data
- Visualize borehole tracks and geological intervals
- Standardize messy geological datasets
- Suggest lithology and seam interpretations
- Allow geologist review and correction
- Generate reports, summaries, and export-ready datasets
- Build a human-in-the-loop learning system over time

## MVP Philosophy

The first version should be useful even before advanced AI models are mature.

The early MVP should prioritize:

1. Data ingestion and validation
2. Clean borehole visualization
3. Editable lithology intervals
4. Basic AI-assisted suggestions
5. Report/export generation
6. Feedback capture from geologists

## Proposed Repository Structure

```text
geoworkbench/
├── frontend/          # React/Tauri/Electron UI in future
├── backend/           # FastAPI services in future
├── ml/                # ML experiments and model pipeline
├── data-models/       # Geological schema definitions
├── docs/              # Product, architecture, and workflow docs
├── sample-data/       # Synthetic or anonymized sample datasets
├── notebooks/         # Data exploration and feasibility notebooks
├── infra/             # Deployment and infrastructure configs
└── architecture/      # System architecture notes and diagrams
```

## Current Status

Planning and discovery phase.

## Current Prototype

The current stakeholder prototype uses the geologist-provided PBH-62 workbook and core image folder:

- Prototype screen: `prototype/pbh-62-log-widget.html`
- Normalized dataset: `sample-data/pbh-62-normalized.json`
- Data extractor: `scripts/extract_pbh62_workbook.py`
- Data mapping: `docs/pbh-62-data-mapping.md`
- Demo walkthrough: `docs/pbh-62-stakeholder-demo-walkthrough.md`

## Run With The Reliance Database Dump

`reliancedata.sql` is a PostgreSQL custom-format, data-only archive; it must be
loaded with `pg_restore` after the Alembic schema migrations. It is not a text
SQL script and should not be passed to `psql -f`.

With Docker Desktop running and PostgreSQL client tools on `PATH`:

```powershell
# Optional when the default ports are already occupied.
$env:POSTGRES_PORT = "55432"
$env:REDIS_PORT = "56379"

.\scripts\restore-reliance-data.ps1
```

The restore script refuses to load into a database that already contains
project data. After it completes, open `http://127.0.0.1:5173`; the API health
endpoint is `http://127.0.0.1:8081/health`.

Next priorities:

- Review real sample geological data
- Define minimum input data formats
- Finalize MVP workflows
- Create first borehole visualization prototype
- Create first lithology/seam data model
- Validate with working geologists

## Important Data Note

Do not commit confidential customer or mine data to this public repository. Use anonymized or synthetic sample data only.
