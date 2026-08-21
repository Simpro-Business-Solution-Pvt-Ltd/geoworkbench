param(
  [string]$BaseUrl = "http://127.0.0.1:8081",
  [string]$Username = "geologist",
  [string]$Password = "geologist123",
  [string]$PreferredProjectCode = "RELIANCE-COAL"
)

$ErrorActionPreference = "Stop"

function Invoke-GeoCheck {
  param(
    [string]$Name,
    [scriptblock]$Action
  )

  Write-Host "[$Name] checking..." -ForegroundColor Cyan
  $result = & $Action
  Write-Host "[$Name] ok" -ForegroundColor Green
  return $result
}

$root = $BaseUrl.TrimEnd("/")
$api = "$root/api"

Invoke-GeoCheck "health" {
  $health = Invoke-RestMethod -Method Get -Uri "$root/health"
  if ($health.status -ne "ok") {
    throw "Expected health status ok, got '$($health.status)'"
  }
  $health
} | Out-Null

Invoke-GeoCheck "diagnostics" {
  $diagnostics = Invoke-RestMethod -Method Get -Uri "$api/diagnostics/health"
  if (-not $diagnostics.status) {
    throw "Diagnostics response did not include status"
  }
  $diagnostics
} | Out-Null

$login = Invoke-GeoCheck "login" {
  Invoke-RestMethod `
    -Method Post `
    -Uri "$api/auth/login" `
    -ContentType "application/json" `
    -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)
}

if (-not $login.token) {
  throw "Login did not return a bearer token"
}

$headers = @{ Authorization = "Bearer $($login.token)" }

Invoke-GeoCheck "current user" {
  $session = Invoke-RestMethod -Method Get -Uri "$api/auth/me" -Headers $headers
  if ($session.user.username -ne $Username) {
    throw "Expected user '$Username', got '$($session.user.username)'"
  }
  $session
} | Out-Null

$boreholes = Invoke-GeoCheck "borehole list" {
  $items = Invoke-RestMethod -Method Get -Uri "$api/boreholes" -Headers $headers
  if (@($items).Count -lt 1) {
    throw "No boreholes returned"
  }
  $items
}

$selectedBorehole = @($boreholes | Where-Object { $_.project_code -eq $PreferredProjectCode } | Select-Object -First 1)
if (-not $selectedBorehole) {
  $selectedBorehole = @($boreholes)[0]
}
Write-Host "Using borehole $($selectedBorehole.code) from project $($selectedBorehole.project_code)." -ForegroundColor DarkCyan

$workbench = Invoke-GeoCheck "workbench" {
  $workbench = Invoke-RestMethod -Method Get -Uri "$api/boreholes/$($selectedBorehole.id)/workbench" -Headers $headers
  if (-not $workbench.code) {
    throw "Workbench response did not include borehole code"
  }
  if (@($workbench.lithology_intervals).Count -lt 1) {
    throw "Workbench did not include lithology intervals"
  }
  $workbench
}

Invoke-GeoCheck "import profiles" {
  $profiles = Invoke-RestMethod -Method Get -Uri "$api/imports/profiles" -Headers $headers
  if (@($profiles).Count -lt 1) {
    throw "No import profiles returned"
  }
  $profiles
} | Out-Null

Invoke-GeoCheck "source file audit" {
  $sourceFiles = Invoke-RestMethod -Method Get -Uri "$api/imports/source-files?borehole_id=$($selectedBorehole.id)" -Headers $headers
  if ($null -eq $sourceFiles) {
    throw "Source file list did not return a response"
  }
  $sourceFiles
} | Out-Null

Invoke-GeoCheck "export profiles" {
  $profiles = Invoke-RestMethod -Method Get -Uri "$api/exports/profiles" -Headers $headers
  if (@($profiles).Count -lt 1) {
    throw "No export profiles returned"
  }
  $profiles
} | Out-Null

Invoke-GeoCheck "export readiness" {
  $readiness = Invoke-RestMethod -Method Get -Uri "$api/exports/boreholes/$($selectedBorehole.id)/readiness" -Headers $headers
  if (-not $readiness.status) {
    throw "Export readiness response did not include status"
  }
  $readiness
} | Out-Null

Invoke-GeoCheck "AI summary" {
  $summary = Invoke-RestMethod -Method Get -Uri "$api/ai/boreholes/$($selectedBorehole.id)/summary" -Headers $headers
  if (-not $summary.summary) {
    throw "AI summary response did not include summary text"
  }
  if (-not $summary.metrics) {
    throw "AI summary response did not include metrics"
  }
  $summary
} | Out-Null

Invoke-GeoCheck "correlation observations" {
  $observations = Invoke-RestMethod -Method Get -Uri "$api/correlation/observations?borehole_ids=$($selectedBorehole.id)" -Headers $headers
  if ($null -eq $observations) {
    throw "Correlation observations did not return a response"
  }
  $observations
} | Out-Null

Write-Host ""
Write-Host "GeoWorkbench UAT smoke passed for $root as $Username using $($workbench.code)." -ForegroundColor Green
