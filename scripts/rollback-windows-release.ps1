#requires -Version 5.1
#requires -RunAsAdministrator
param([Parameter(Mandatory = $true)][string]$BackupPath)

$ErrorActionPreference = "Stop"
$backup = (Resolve-Path -LiteralPath $BackupPath).Path
$state = Get-Content -LiteralPath (Join-Path $backup "deployment.json") -Raw | ConvertFrom-Json
if ($state.service_id -ne "GeoWorkbenchApi") { throw "Not a GeoWorkbench deployment backup." }
foreach ($path in @((Join-Path $backup "GeoWorkbenchApi.xml"), (Join-Path $backup "frontend\index.html"),
    (Join-Path $state.previous_backend ".venv\Scripts\python.exe"))) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Missing rollback file: $path" }
}

Stop-Service -Name $state.service_id
(Get-Service -Name $state.service_id).WaitForStatus('Stopped', [TimeSpan]::FromSeconds(60))
Copy-Item -LiteralPath (Join-Path $backup "GeoWorkbenchApi.xml") -Destination $state.service_xml -Force
& robocopy (Join-Path $backup "frontend") $state.web_root /E /R:2 /W:1 /XF index.html /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Frontend restore failed (robocopy $LASTEXITCODE)." }
Copy-Item -LiteralPath (Join-Path $backup "frontend\index.html") -Destination (Join-Path $state.web_root "index.html") -Force
Start-Service -Name $state.service_id
Write-Host "Previous release restored: $($state.previous_backend)" -ForegroundColor Green
Write-Host "Run the server smoke script again. PostgreSQL and uploaded files were not replaced."
