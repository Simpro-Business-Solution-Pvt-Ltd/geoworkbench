param(
    [string]$Suffix = "postdemo"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$commit = (& git -C $repoRoot rev-parse --short HEAD).Trim()
$branch = (& git -C $repoRoot branch --show-current).Trim()
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "geoworkbench-uat-$commit-$Suffix-$stamp"
$packageRoot = Join-Path $repoRoot "release-packages"
$stage = Join-Path $packageRoot $name
$zip = Join-Path $packageRoot "$name.zip"

if (!(Test-Path $packageRoot)) {
    New-Item -ItemType Directory -Path $packageRoot | Out-Null
}

$resolvedPackageRoot = (Resolve-Path $packageRoot).Path
$stageParent = Split-Path -Parent $stage
if ($stageParent -ne $resolvedPackageRoot) {
    throw "Refusing to stage outside release-packages: $stage"
}

if (Test-Path $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
if (Test-Path $zip) {
    Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Path $stage | Out-Null

robocopy (Join-Path $repoRoot "backend") (Join-Path $stage "backend") /E /XD .venv __pycache__ .pytest_cache /XF *.pyc *.pyo .env *.db | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy backend failed with exit code $LASTEXITCODE" }

robocopy (Join-Path $repoRoot "frontend\dist") (Join-Path $stage "frontend-dist") /E | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy frontend failed with exit code $LASTEXITCODE" }

robocopy (Join-Path $repoRoot "docs") (Join-Path $stage "docs") /E | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy docs failed with exit code $LASTEXITCODE" }

New-Item -ItemType Directory -Path (Join-Path $stage "scripts") | Out-Null
Copy-Item (Join-Path $repoRoot "scripts\uat-smoke.ps1") (Join-Path $stage "scripts\uat-smoke.ps1") -Force
Copy-Item (Join-Path $repoRoot "docs\wiki\deployment\uat-server-package.md") (Join-Path $stage "DEPLOYMENT-INSTRUCTIONS.md") -Force

$apk = Get-ChildItem (Join-Path $repoRoot "mobile\geoworkbench_mobile\build") -Recurse -Filter app-debug.apk -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if ($apk) {
    New-Item -ItemType Directory -Path (Join-Path $stage "mobile") | Out-Null
    Copy-Item $apk.FullName (Join-Path $stage "mobile\app-debug.apk") -Force
}

@{
    name = $name
    commit = $commit
    branch = $branch
    built_at = (Get-Date).ToString("s")
} | ConvertTo-Json | Set-Content -Path (Join-Path $stage "RELEASE.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal

Get-Item $zip | Select-Object FullName, Length, LastWriteTime
