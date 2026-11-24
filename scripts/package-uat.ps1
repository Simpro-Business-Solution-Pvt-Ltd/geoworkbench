param(
    [ValidatePattern('^[a-zA-Z0-9-]+$')][string]$Suffix = "reliance-uat",
    [switch]$SkipFrontendBuild,
    [switch]$IncludeAndroidApk
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (& git -C $repoRoot status --porcelain) {
    throw "Commit source changes before packaging so RELEASE.json identifies the shipped code."
}
$commit = (& git -C $repoRoot rev-parse --short HEAD).Trim()
$fullCommit = (& git -C $repoRoot rev-parse HEAD).Trim()
$branch = (& git -C $repoRoot branch --show-current).Trim()
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$name = "geoworkbench-uat-$commit-$Suffix-$stamp"
$packageRoot = Join-Path $repoRoot "release-packages"
$stage = Join-Path $packageRoot $name
$zip = Join-Path $packageRoot "$name.zip"

if (-not $SkipFrontendBuild) {
    Push-Location (Join-Path $repoRoot "frontend")
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed." }
    } finally { Pop-Location }
}
foreach ($file in @("index.html", "web.config", "manifest.webmanifest", "sw.js")) {
    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "frontend\dist\$file"))) {
        throw "Incomplete frontend build: $file"
    }
}

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

# Archive committed sources only: local environments, uploads and caches cannot leak in.
$sourceArchive = Join-Path $packageRoot "$name-sources.zip"
try {
    & git -C $repoRoot archive --format=zip --output=$sourceArchive HEAD backend docs scripts/package-uat.ps1 scripts/uat-smoke.ps1 scripts/deploy-windows-release.ps1 scripts/rollback-windows-release.ps1
    if ($LASTEXITCODE -ne 0) { throw "Source archive failed." }
    Expand-Archive -LiteralPath $sourceArchive -DestinationPath $stage
} finally {
    if (Test-Path -LiteralPath $sourceArchive) { Remove-Item -LiteralPath $sourceArchive -Force }
}

robocopy (Join-Path $repoRoot "frontend\dist") (Join-Path $stage "frontend-dist") /E | Out-Null
if ($LASTEXITCODE -gt 7) { throw "robocopy frontend failed with exit code $LASTEXITCODE" }

Copy-Item (Join-Path $repoRoot "docs\wiki\deployment\uat-server-package.md") (Join-Path $stage "DEPLOYMENT-INSTRUCTIONS.md") -Force

$apk = if ($IncludeAndroidApk) { Get-ChildItem (Join-Path $repoRoot "mobile\geoworkbench_mobile\build") -Recurse -Filter app-debug.apk -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 }
if ($apk) {
    New-Item -ItemType Directory -Path (Join-Path $stage "mobile") | Out-Null
    Copy-Item $apk.FullName (Join-Path $stage "mobile\app-debug.apk") -Force
}

@{
    name = $name
    commit = $commit
    full_commit = $fullCommit
    branch = $branch
    built_at = (Get-Date).ToString("s")
} | ConvertTo-Json | Set-Content -Path (Join-Path $stage "RELEASE.json") -Encoding UTF8

$files = Get-ChildItem -LiteralPath $stage -Recurse -File | ForEach-Object {
    @{
        path = $_.FullName.Substring($stage.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, [char]'/')
        sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
}
@{ files = @($files) } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $stage "FILE-HASHES.json") -Encoding UTF8

Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal
Get-FileHash -LiteralPath $zip -Algorithm SHA256 | Format-List

Get-Item $zip | Select-Object FullName, Length, LastWriteTime
