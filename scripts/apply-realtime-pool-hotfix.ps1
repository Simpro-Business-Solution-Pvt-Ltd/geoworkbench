#requires -Version 5.1
#requires -RunAsAdministrator
param([string]$ServiceXmlPath = "C:\GeoWorkbench\service\GeoWorkbenchApi.xml")

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root "backend\app\domains\realtime\router.py"
$manifest = Get-Content -LiteralPath (Join-Path $root "HOTFIX.json") -Raw | ConvertFrom-Json
if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $manifest.patched_sha256) {
    throw "The packaged router does not match HOTFIX.json. Extract the original hotfix zip again."
}
[xml]$config = Get-Content -LiteralPath $ServiceXmlPath -Raw
if ([string]$config.service.id -ne "GeoWorkbenchApi") { throw "Expected the GeoWorkbenchApi service XML." }
$serviceBase = Split-Path -Parent (Resolve-Path -LiteralPath $ServiceXmlPath).Path
$backend = [Environment]::ExpandEnvironmentVariables(
    ([string]$config.service.workingdirectory).Replace("%BASE%", $serviceBase)
).Trim('"')
$backend = (Resolve-Path -LiteralPath $backend).Path
$target = Join-Path $backend "app\domains\realtime\router.py"
$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $python)) { throw "Backend Python not found: $python" }
$actualHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($actualHash -eq $manifest.patched_sha256) {
    Write-Host "This router already has the hotfix. Restart the API service if it has not been restarted."
    return
}
if ($actualHash -notin @($manifest.original_sha256_lf, $manifest.original_sha256_crlf)) {
    throw "The server router differs from the supported original. No files changed. Review it before applying this hotfix."
}
& $python -c "import pathlib,sys; p=pathlib.Path(sys.argv[1]); compile(p.read_text(encoding='utf-8-sig'),str(p),'exec')" $source
if ($LASTEXITCODE -ne 0) { throw "Patched router failed the server Python syntax check." }

$backup = "$target.before-pool-hotfix-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $target -Destination $backup
Write-Host "Backend: $backend"
Write-Host "Router backup: $backup"
try {
    Stop-Service GeoWorkbenchApi
    (Get-Service GeoWorkbenchApi).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
    Copy-Item -LiteralPath $source -Destination $target -Force
    Start-Service GeoWorkbenchApi
    $healthy = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        try {
            $health = Invoke-RestMethod 'http://127.0.0.1:8081/api/diagnostics/health' -TimeoutSec 5
            if ($health.database.status -eq "ok") { $healthy = $true; break }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $healthy) { throw "API/database health did not recover after the hotfix." }
    Write-Host "Hotfix installed. API/database healthy. Reopen workbenches and retest login." -ForegroundColor Green
} catch {
    $failure = $_
    try {
        Stop-Service GeoWorkbenchApi -ErrorAction SilentlyContinue
        (Get-Service GeoWorkbenchApi).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
        Copy-Item -LiteralPath $backup -Destination $target -Force
        Start-Service GeoWorkbenchApi
        Write-Warning "Previous router restored. Inspect backend logs and the reported database error."
    } catch { Write-Warning "Automatic restore failed. Original router is at $backup" }
    throw $failure
}
