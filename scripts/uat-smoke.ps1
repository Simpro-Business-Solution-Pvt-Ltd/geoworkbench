param(
  [string]$BaseUrl = "http://127.0.0.1:8081",
  [string]$Username = "geologist",
  [string]$Password = "geologist123"
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
  if ($items.Count -lt 1) {
    throw "No boreholes returned"
  }
  $items
}

$firstBorehole = @($boreholes)[0]
Invoke-GeoCheck "workbench" {
  $workbench = Invoke-RestMethod -Method Get -Uri "$api/boreholes/$($firstBorehole.id)/workbench" -Headers $headers
  if (-not $workbench.code) {
    throw "Workbench response did not include borehole code"
  }
  $workbench
} | Out-Null

Write-Host ""
Write-Host "GeoWorkbench UAT smoke passed for $root as $Username." -ForegroundColor Green
