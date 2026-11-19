# Field Upload and Storage Path Hotfix

Prepared 19 November 2026. This cumulative backend-only patch also includes the
earlier realtime database-pool fix.

## Reproduced Failure

Creating a borehole through the local PWA API succeeded. Uploading the same
original CTSJ Excel succeeded with the default in-repository upload directory,
but returned HTTP 500 with an external upload directory. The traceback was:

```text
upload_source_file -> target_path.relative_to(settings.repo_root)
ValueError: ... is not in the subpath of ...
```

The server's configured upload root can be outside the deployed release folder.
This is a valid deployment layout. The previous implementation wrote the file
and then failed before registering its source record. It could therefore leave
an orphan file after returning 500. Export generation had the same relative-path
assumption.

## Fix and Compatibility

The shared `local_file_reference` helper keeps relative references for files
inside the repository root, and stores absolute references for configured local
storage outside it. Existing import/process/merge and export-download readers
already accept absolute paths, so existing records remain readable. No database
migration, `.env` change, frontend build or dependency update is needed.

Included backend files:

- `app/core/storage_paths.py`: new shared path helper.
- `app/domains/imports/service.py`: register uploads in either storage layout.
- `app/domains/exports/service.py`: record generated exports in either layout.
- `app/domains/realtime/router.py`: release authentication DB connections before SSE.

The patch does not move existing files or remove orphaned uploads. It does not
turn an uploaded image or PDF into interpreted geological data. An absolute local
reference also does not make files portable to another server; retain the configured
data roots or plan a separate storage migration.

## Local Verification

- The unmodified external-storage flow returned 500 and the normal-storage flow passed.
- After the fix, the real multipart PWA endpoint accepted the CTSJ workbook,
  Reliance `Lithology_10BH.xlsx`, `MGCA-08.las`, `SPNG-05-Composite.pdf`, and original
  `MTSE-65(PBH 62)/1.jpg`. Each returned 200, retained its borehole association,
  and matched the original bytes in external storage.
- Real source files were associated only with the clearly named local QA borehole
  `UAT-PWA-API-20261119-01`; received MGCA geology was not overwritten. The mixed
  source uploads are storage tests, not aligned geological interpretation evidence.
- API integration tests cover field login, empty borehole creation, interval and
  parameter capture, four attachment types, Excel template/process/merge, LAS merge,
  central workbench data, and Excel/LAS generation and download. The entire sequence
  runs with storage both inside and outside the source root.
- 71 backend tests passed, including the realtime connection-lifetime regression.
- Browser automation stopped because it could not verify the browser URL.
  Native browser/file-picker/device interaction was not completed; the checks above
  exercised the actual PWA HTTP endpoints and isolated API integration tests.

## Apply on the Server

Extract the supplied cumulative hotfix ZIP and run the script as Administrator:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
$zip = 'C:\GeoWorkbench\geoworkbench-field-upload-hotfix-<commit>.zip'
$folder = Join-Path 'C:\GeoWorkbench\hotfixes' ([IO.Path]::GetFileNameWithoutExtension($zip))
Expand-Archive -LiteralPath $zip -DestinationPath $folder
& (Join-Path $folder 'scripts\apply-field-upload-hotfix.ps1')
```

The script finds the current backend from
`C:\GeoWorkbench\service\GeoWorkbenchApi.xml`, validates file hashes and server
Python syntax, backs up existing files, restarts the API around the replacement,
and checks database health. It accepts the supported original router or the prior
realtime hotfix. If the other original files differ from the reviewed versions,
it stops before modifying them. On startup/health failure it attempts to restore
the original backend files.

Retain the printed backup folder. The existing release metadata still identifies
the base release; keep the included `HOTFIX.json` with the deployment record.

## Verify on the Server

1. Diagnostics reports database status `ok` and login works.
2. In `/field`, create/select a clearly labelled test borehole.
3. Upload Excel, LAS and a photo. Verify success status and that the files persist
   in the borehole's attachment list after a refresh.
4. In central Import, verify those files belong to that exact borehole. Process
   supported Excel/LAS inputs and merge only into the test record.
5. Generate and download a test Excel/LAS export from the configured export root.
6. Keep workbenches connected and repeat diagnostics to exercise the SSE fix.

Reusing files does not imply their internal borehole identifiers match the new
test code. Where applicable, choose the source borehole explicitly during merge.
