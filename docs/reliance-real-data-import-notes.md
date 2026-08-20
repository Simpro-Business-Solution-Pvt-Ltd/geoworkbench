# Reliance Real Data Import Notes

## Source Package

Local source folder: `RelianceData/`

Extracted files used:

- `Data_10BH/Data_10BH/Collar_10BH.xlsx`
- `Data_10BH/Data_10BH/Lithology_10BH.xlsx`
- `Data_10BH/Data_10BH/Band_by_band_10BH.xlsx`
- `Data_10BH/Data_10BH/Dirt_band_10BH.xlsx`
- `Data_10BH/Data_10BH/Overall analysis_10BH.xlsx`
- `LAS/LAS/*.las`

Corebox images were not included in this Reliance batch.

## Import Strategy

The Reliance package is a consolidated multi-borehole dataset, not one descriptive workbook per borehole.

Current mapping:

- `Collar_10BH.xlsx` -> borehole `attributes.collar`
- `Lithology_10BH.xlsx` -> `lithology_intervals`
- `Dirt_band_10BH.xlsx` -> `seam_intervals`
- `Band_by_band_10BH.xlsx` -> seam interval evidence in `seam_intervals.attributes.band_by_band`
- `Overall analysis_10BH.xlsx` -> seam interval evidence in `seam_intervals.attributes.overall_analysis`
- `*.las` -> `curves` and full-resolution `curve_samples`

The database stores all LAS samples. The workbench API returns display-ready curve samples and includes `full_sample_count` in each curve's metadata.

## Local Results

Project: `RELIANCE-COAL`  
Site: `MGCA`

Imported boreholes:

| Borehole | Total Depth | Lithology Intervals | Seam Intervals | Curves | LAS Samples |
|---|---:|---:|---:|---:|---:|
| MGCA-08 | 801.0 | 781 | 50 | 7 | 426,883 |
| MGCA-09 | 996.0 | 946 | 47 | 9 | 470,676 |
| MGCA-11 | 1052.0 | 1004 | 60 | 6 | 376,580 |
| MGCA-12 | 843.0 | 819 | 52 | 4 | 334,974 |
| MGCA-16 | 906.0 | 927 | 52 | 8 | 448,016 |
| MGCA-18 | 1146.0 | 1099 | 57 | 7 | 507,899 |
| MGCA-19 | 954.0 | 956 | 47 | 5 | 332,676 |
| MGCA-21 | 771.0 | 759 | 38 | 6 | 270,556 |
| MGCA-22 | 909.0 | 920 | 52 | 7 | 430,640 |
| MGCA-23 | 834.0 | 874 | 53 | 7 | 379,343 |

Total LAS samples stored: `3,978,243`.

## Commands

Profile only:

```powershell
python backend/scripts/import_reliance_data.py --profile-only
```

Import into the configured database:

```powershell
python backend/scripts/import_reliance_data.py
```

Production import with external Postgres should run after setting `GEOWORKBENCH_DATABASE_URL` and applying migrations.

```powershell
$env:GEOWORKBENCH_DATABASE_URL="postgresql+psycopg://user:password@server:5432/geoworkbench"
alembic -c backend/alembic.ini upgrade head
python backend/scripts/import_reliance_data.py
```

## Notes For UAT

- Real Reliance data is now available as boreholes `MGCA-08` to `MGCA-23`.
- Corebox image tracks are hidden for these boreholes because no corebox image package was supplied.
- RQD track is hidden because this batch does not contain RQD values.
- The workbench displays Reliance LAS curves such as Natural Gamma, Resistivity, Point Resistance, SP, Caliper, Density, Bed Resolution Density, Inclination, Azimuth, and Neutron where present.
- Validation now groups missing RQD/corebox-image findings so the user sees data-availability issues without thousands of repeated warnings.
