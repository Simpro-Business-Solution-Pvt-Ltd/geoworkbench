#requires -Version 5.1
param(
    [Parameter(Mandatory = $true)][string]$ReleasePath,
    [string]$EnvSource,
    [string]$ServiceXmlPath = "C:\GeoWorkbench\service\GeoWorkbenchApi.xml",
    [string]$WebRoot = "C:\inetpub\geoworkbench",
    [string]$BackupRoot = "C:\GeoWorkbench\deployment-backups",
    [switch]$DisableRedis,
    [switch]$ReplaceIisConfig,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

function Copy-Tree([string]$Source, [string]$Destination, [string[]]$Extra = @()) {
    & robocopy $Source $Destination /E /R:2 /W:1 /NFL /NDL /NJH /NJS @Extra | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "Copy failed: $Source -> $Destination (robocopy $LASTEXITCODE)" }
}

function Wait-Api {
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $health = Invoke-RestMethod "http://127.0.0.1:8081/health" -TimeoutSec 3
            $diagnostics = Invoke-RestMethod "http://127.0.0.1:8081/api/diagnostics/health" -TimeoutSec 5
            if ($health.status -eq "ok" -and $diagnostics.database.status -eq "ok") { return }
        } catch { }
        Start-Sleep -Seconds 2
    }
    throw "API/database health failed. Inspect the WinSW logs beside $ServiceXmlPath."
}

function Set-ServiceElement([xml]$Document, [string]$Name, [string]$Value) {
    $node = $Document.service.SelectSingleNode($Name)
    if (-not $node) {
        $node = $Document.CreateElement($Name)
        [void]$Document.service.AppendChild($node)
    }
    $node.InnerText = $Value
}

$release = (Resolve-Path -LiteralPath $ReleasePath).Path
$backend = Join-Path $release "backend"
$frontend = Join-Path $release "frontend-dist"
$serviceXml = (Resolve-Path -LiteralPath $ServiceXmlPath).Path
[xml]$config = Get-Content -LiteralPath $serviceXml -Raw
$serviceId = [string]$config.service.id
if ($serviceId -ne "GeoWorkbenchApi") { throw "Expected GeoWorkbenchApi in $serviceXml." }

$oldBackend = [string]$config.service.workingdirectory
if (-not $oldBackend) { throw "The service XML must contain workingdirectory. Pass the current backend path in its XML first." }
$serviceBase = Split-Path -Parent $serviceXml
$oldBackend = [Environment]::ExpandEnvironmentVariables($oldBackend.Replace("%BASE%", $serviceBase)).Trim('"')
$oldBackend = (Resolve-Path -LiteralPath $oldBackend).Path
if ($oldBackend -eq $backend) { throw "Extract into a new release folder; the current service already uses $backend." }

foreach ($relative in @("backend\app\main.py", "backend\pyproject.toml", "RELEASE.json",
    "frontend-dist\index.html", "frontend-dist\web.config", "frontend-dist\sw.js",
    "frontend-dist\manifest.webmanifest", "scripts\rollback-windows-release.ps1")) {
    if (-not (Test-Path -LiteralPath (Join-Path $release $relative) -PathType Leaf)) {
        throw "Incomplete release: missing $relative"
    }
}
$releaseInfo = Get-Content -LiteralPath (Join-Path $release "RELEASE.json") -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath (Join-Path $frontend "manifest.webmanifest") -Raw | ConvertFrom-Json
if ($manifest.start_url -ne "/field") { throw "Expected the field PWA manifest to start at /field." }
$index = Get-Content -LiteralPath (Join-Path $frontend "index.html") -Raw
$assets = [regex]::Matches($index, '(?:src|href)="(/assets/[^"?]+)"')
if ($assets.Count -lt 2) { throw "No production JS/CSS assets found in index.html." }
foreach ($asset in $assets) {
    if (-not (Test-Path -LiteralPath (Join-Path $frontend $asset.Groups[1].Value.TrimStart('/')))) {
        throw "Missing frontend asset $($asset.Groups[1].Value)"
    }
}

$targetEnv = Join-Path $backend ".env"
if (Test-Path -LiteralPath $targetEnv) {
    $envFile = $targetEnv
} elseif ($EnvSource) {
    $envFile = (Resolve-Path -LiteralPath $EnvSource).Path
} else {
    $envFile = (Resolve-Path -LiteralPath (Join-Path $oldBackend ".env")).Path
}
$web = (Resolve-Path -LiteralPath $WebRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $web "index.html"))) {
    throw "Expected an existing GeoWorkbench IIS root at $web."
}
Write-Host "Release: $($releaseInfo.name) ($($releaseInfo.commit))"
Write-Host "Backend: $oldBackend -> $backend"
Write-Host "Environment source: $envFile"
Write-Host "IIS root: $web"
if ($CheckOnly) {
    Write-Host "Package/path checks passed. No service, database or IIS files changed." -ForegroundColor Green
    return
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run this script in Administrator PowerShell."
}
$service = Get-Service -Name $serviceId

# Older records may contain paths relative to repo_root; retain their effective roots.
$oldPython = Join-Path $oldBackend ".venv\Scripts\python.exe"
if (-not (Test-Path -LiteralPath $oldPython)) { throw "Current backend Python not found: $oldPython" }
Push-Location $oldBackend
try {
    $oldStorageJson = & $oldPython -c "import json; from app.core.config import get_settings; s=get_settings(); print(json.dumps({k:str(getattr(s,k)) for k in ('repo_root','upload_root','export_root')}))"
    if ($LASTEXITCODE -ne 0) { throw "Could not read the current backend's storage settings." }
    $oldStorage = $oldStorageJson | ConvertFrom-Json
} finally { Pop-Location }

# Prepare dependencies before stopping the existing service.
if ($envFile -ne $targetEnv) { Copy-Item -LiteralPath $envFile -Destination $targetEnv }
Push-Location $backend
try {
    if (-not (Test-Path -LiteralPath ".venv\Scripts\python.exe")) {
        & py -3.11 -m venv .venv
        if ($LASTEXITCODE -ne 0) { throw "Python 3.11 virtual environment creation failed." }
    }
    $python = Join-Path $backend ".venv\Scripts\python.exe"
    & $python -m pip install -e .
    if ($LASTEXITCODE -ne 0) { throw "Backend dependency installation failed." }
    & $python -c "import os, sys; from dotenv import dotenv_values, set_key; d=dotenv_values('.env'); keys=('GEOWORKBENCH_REPO_ROOT','GEOWORKBENCH_UPLOAD_ROOT','GEOWORKBENCH_EXPORT_ROOT'); [(set_key('.env', k, v)) for k,v in zip(keys,sys.argv[1:]) if not d.get(k) and not os.environ.get(k)]" $oldStorage.repo_root $oldStorage.upload_root $oldStorage.export_root
    if ($LASTEXITCODE -ne 0) { throw "Could not preserve existing storage roots in the new environment." }
    if ($DisableRedis) {
        & $python -c "from dotenv import set_key; set_key('.env', 'GEOWORKBENCH_CACHE_ENABLED', 'false'); set_key('.env', 'GEOWORKBENCH_REALTIME_REDIS_ENABLED', 'false')"
        if ($LASTEXITCODE -ne 0) { throw "Could not disable Redis in the new release environment." }
    }
    & $python -c "from app.core.config import get_settings; from sqlalchemy import create_engine, text; s=get_settings(); assert s.database_url.startswith('postgresql'), 'Expected your existing PostgreSQL configuration'; e=create_engine(s.database_url); c=e.connect(); c.execute(text('select 1')); c.close(); e.dispose(); print('PostgreSQL connection OK'); print('Uploads:', s.upload_root); print('Exports:', s.export_root)"
    if ($LASTEXITCODE -ne 0) { throw "New backend environment/database preflight failed." }
} finally { Pop-Location }

$backup = Join-Path ([IO.Path]::GetFullPath($BackupRoot)) ("{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $releaseInfo.commit)
if (Test-Path -LiteralPath $backup) { throw "Backup already exists: $backup" }
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $serviceXml -Destination (Join-Path $backup "GeoWorkbenchApi.xml")
Copy-Tree $web (Join-Path $backup "frontend")
$state = @{
    service_id = $serviceId
    service_xml = $serviceXml
    previous_backend = $oldBackend
    web_root = $web
    new_release = $release
    commit = $releaseInfo.commit
    previous_service_running = ($service.Status -eq "Running")
}
$state | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup "deployment.json") -Encoding UTF8
Write-Host "Rollback backup: $backup" -ForegroundColor Cyan

$serviceChanged = $false
$frontendChanged = $false
try {
    Stop-Service -Name $serviceId
    (Get-Service -Name $serviceId).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        $listeners = @(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)
        if (-not $listeners.Count) { break }
        Start-Sleep -Seconds 1
    }
    if ($listeners.Count) {
        throw "Port 8081 is still occupied by PID(s) $($listeners.OwningProcess -join ', '). No processes were killed."
    }
    Set-ServiceElement $config "executable" $python
    Set-ServiceElement $config "arguments" "-m uvicorn app.main:app --host 127.0.0.1 --port 8081"
    Set-ServiceElement $config "workingdirectory" $backend
    $config.Save($serviceXml)
    $serviceChanged = $true
    Start-Service -Name $serviceId
    Wait-Api

    # Keep old hashed assets for already-open tabs; publish the new HTML last.
    $exclude = @("/XF", "index.html")
    if ((Test-Path -LiteralPath (Join-Path $web "web.config")) -and -not $ReplaceIisConfig) {
        $exclude += "web.config"
    }
    $frontendChanged = $true
    Copy-Tree $frontend $web $exclude
    Copy-Item -LiteralPath (Join-Path $frontend "index.html") -Destination (Join-Path $web "index.html") -Force
    Write-Host "Deployment complete. Service running, API and PostgreSQL healthy." -ForegroundColor Green
    Write-Host "Web: https://geowb.simproapps.in/ | Field PWA: https://geowb.simproapps.in/field"
    Write-Host "Keep $oldBackend and $backup until server smoke checks pass."
} catch {
    $failure = $_
    try {
        Stop-Service -Name $serviceId -ErrorAction SilentlyContinue
        if ($serviceChanged) {
            Copy-Item -LiteralPath (Join-Path $backup "GeoWorkbenchApi.xml") -Destination $serviceXml -Force
        }
        if ($frontendChanged) { Copy-Tree (Join-Path $backup "frontend") $web }
        if ($state.previous_service_running) { Start-Service -Name $serviceId }
        Write-Warning "Previous service config and frontend restored. Backup: $backup"
    } catch {
        Write-Warning "Automatic restore failed: $($_.Exception.Message). Use rollback-windows-release.ps1 with $backup."
    }
    throw $failure
}
