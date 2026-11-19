#requires -Version 5.1
#requires -RunAsAdministrator
param([string]$ServiceXmlPath = "C:\GeoWorkbench\service\GeoWorkbenchApi.xml")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $root "HOTFIX.json") -Raw | ConvertFrom-Json
[xml]$config = Get-Content -LiteralPath $ServiceXmlPath -Raw
if ([string]$config.service.id -ne "GeoWorkbenchApi") { throw "Expected GeoWorkbenchApi service XML." }
$serviceBase = Split-Path -Parent (Resolve-Path -LiteralPath $ServiceXmlPath).Path
$backend = [Environment]::ExpandEnvironmentVariables(
    ([string]$config.service.workingdirectory).Replace("%BASE%", $serviceBase)
).Trim('"')
$backend = (Resolve-Path -LiteralPath $backend).Path
$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) { throw "Backend Python not found: $python" }

# Validate every file before stopping the service or replacing anything.
foreach ($file in $manifest.files) {
    $source = Join-Path (Join-Path $root "backend") $file.path
    $target = [IO.Path]::GetFullPath((Join-Path $backend $file.path))
    if (-not $target.StartsWith($backend.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unexpected destination outside the active backend: $($file.path)"
    }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $file.sha256) {
        throw "Patch checksum mismatch: $($file.path)"
    }
    if (Test-Path -LiteralPath $target) {
        $actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
        if ($actual -ne $file.sha256 -and $actual -notin @($file.original_hashes)) {
            throw "Server file differs from the supported versions: $($file.path). No files changed."
        }
    } elseif (-not $file.allow_missing) {
        throw "Expected backend file is missing: $target"
    }
    & $python -c "import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding='utf-8-sig'),str(p),'exec')" $source
    if ($LASTEXITCODE -ne 0) { throw "Server Python syntax check failed: $($file.path)" }
}

$backup = Join-Path $serviceBase ("hotfix-backups\field-upload-{0}-{1}" -f $manifest.commit, (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup | Out-Null
$originals = @()
foreach ($file in $manifest.files) {
    $target = Join-Path $backend $file.path
    if (Test-Path -LiteralPath $target) {
        $saved = Join-Path $backup $file.path
        New-Item -ItemType Directory -Path (Split-Path -Parent $saved) -Force | Out-Null
        Copy-Item -LiteralPath $target -Destination $saved
        $originals += $file.path
    }
}
Copy-Item -LiteralPath (Join-Path $root 'HOTFIX.json') -Destination (Join-Path $backup 'HOTFIX.json')
Write-Host "Active backend: $backend"
Write-Host "Original files backed up to: $backup"

try {
    Stop-Service GeoWorkbenchApi
    (Get-Service GeoWorkbenchApi).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
    foreach ($file in $manifest.files) {
        Copy-Item -LiteralPath (Join-Path (Join-Path $root 'backend') $file.path) -Destination (Join-Path $backend $file.path) -Force
    }
    Start-Service GeoWorkbenchApi
    $healthy = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8081/api/diagnostics/health' -TimeoutSec 5
            if ($health.database.status -eq 'ok') { $healthy = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $healthy) { throw 'API/database health failed after the patch.' }
    Write-Host 'Backend hotfix installed. Recheck field upload and central import/export.' -ForegroundColor Green
} catch {
    $failure = $_
    try {
        Stop-Service GeoWorkbenchApi -ErrorAction SilentlyContinue
        (Get-Service GeoWorkbenchApi).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
        foreach ($path in $originals) {
            Copy-Item -LiteralPath (Join-Path $backup $path) -Destination (Join-Path $backend $path) -Force
        }
        # An unused newly added helper is harmless after restoring the previous services.
        Start-Service GeoWorkbenchApi
        Write-Warning 'Original backend files restored. Inspect the API service logs.'
    } catch { Write-Warning "Automatic restore failed. Originals are at $backup" }
    throw $failure
}
