$ErrorActionPreference = "Stop"
$repo = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$qaRoot = Join-Path $repo ".vetto-qa"
$dbData = Join-Path $qaRoot "postgres"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$pgCtl = Join-Path $pgBin "pg_ctl.exe"
$pgIsReady = Join-Path $pgBin "pg_isready.exe"
$createdb = Join-Path $pgBin "createdb.exe"
$port = 55432
$appPort = 38217
$mockAiPort = 38218
$baseUrl = "http://127.0.0.1:$appPort"
$aiControlUrl = "http://127.0.0.1:$mockAiPort/__mode"
$fixtures = Join-Path $qaRoot "fixtures"
$storage = Join-Path $qaRoot "uploads"
$nextProcess = $null
$aiProcess = $null
$pgStartedHere = $false

New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null

function Invoke-Checked {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Command $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
  }
}

try {
  if (-not (Test-Path -LiteralPath (Join-Path $dbData "PG_VERSION"))) {
    Invoke-Checked (Join-Path $pgBin "initdb.exe") @(
      "-D", $dbData, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"
    )
  }

  & $pgCtl status -D $dbData *> $null
  if ($LASTEXITCODE -ne 0) {
    Invoke-Checked $pgCtl @(
      "-D", $dbData, "-o", "-p $port -h 127.0.0.1",
      "-l", (Join-Path $qaRoot "postgres.log"), "-w", "start"
    )
    $pgStartedHere = $true
  }

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    & $pgIsReady -h 127.0.0.1 -p $port *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 300
  }
  if (-not $ready) { throw "Temporary PostgreSQL did not become ready on port $port." }

  $env:DATABASE_URL = "postgresql://postgres@127.0.0.1:$port/vetto?schema=public"
  $env:NODE_ENV = "development"
  $env:STORAGE_DRIVER = "local"
  $env:LOCAL_STORAGE_ROOT = $storage
  $env:AI_API_KEY = "vetto-local-qa-placeholder"
  $env:AI_BASE_URL = "http://127.0.0.1:$mockAiPort/v1"
  $env:VETTO_MOCK_AI_PORT = "$mockAiPort"
  $env:AI_MODEL = "vetto-qa-mock"
  $env:NEXT_PUBLIC_APP_URL = $baseUrl

  $databaseExists = & (Join-Path $pgBin "psql.exe") `
    -h 127.0.0.1 -p $port -U postgres -d postgres -tAc `
    "SELECT 1 FROM pg_database WHERE datname = 'vetto'"
  if ($LASTEXITCODE -ne 0) { throw "Could not query the temporary PostgreSQL cluster." }
  if ($databaseExists.Trim() -ne "1") {
    Invoke-Checked $createdb @("-h", "127.0.0.1", "-p", "$port", "-U", "postgres", "vetto")
  }

  Invoke-Checked "npx.cmd" @("prisma", "migrate", "deploy")
  Invoke-Checked "npm.cmd" @("run", "db:seed")
  Invoke-Checked "node.exe" @("scripts/verify-seed-guard.mjs")

  $env:NODE_ENV = "production"
  Invoke-Checked "node.exe" @("scripts/create-large-fixtures.mjs", $fixtures)
  Invoke-Checked "npm.cmd" @("run", "lint")
  Invoke-Checked "npm.cmd" @("run", "typecheck")
  Invoke-Checked "npm.cmd" @("run", "build")

  $node = (Get-Command node.exe).Source
  $aiProcess = Start-Process -FilePath $node `
    -ArgumentList @("scripts/mock-ai-provider.mjs") `
    -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $qaRoot "mock-ai.log") `
    -RedirectStandardError (Join-Path $qaRoot "mock-ai-error.log")
  $nextProcess = Start-Process -FilePath $node `
    -ArgumentList @("node_modules/next/dist/bin/next", "start", "-p", "$appPort") `
    -WorkingDirectory $repo -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $qaRoot "next.log") `
    -RedirectStandardError (Join-Path $qaRoot "next-error.log")

  $healthy = $false
  for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
    try {
      $health = Invoke-RestMethod "$baseUrl/api/health" -TimeoutSec 2
      if ($health.status -eq "ok") {
        $healthy = $true
        break
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  if (-not $healthy) {
    Get-Content (Join-Path $qaRoot "next-error.log") -ErrorAction SilentlyContinue
    throw "Production server or database health check failed. See $qaRoot\next.log."
  }

  $env:BASE_URL = $baseUrl
  $env:VETTO_E2E_AI_CONTROL_URL = $aiControlUrl
  $env:VETTO_E2E_IMAGE = Join-Path $fixtures "large-poster.png"
  $env:VETTO_E2E_PDF = Join-Path $fixtures "large-offer.pdf"
  $env:VETTO_E2E_DOCX = Join-Path $fixtures "large-brand-brief.docx"
  $env:VETTO_E2E_WEBP = Join-Path $fixtures "large-poster.webp"

  Invoke-Checked "node.exe" @("scripts/verify-e2e.mjs")
  Invoke-Checked "node.exe" @("scripts/verify-review.mjs")

  Write-Host "VETTO QA complete. Logs and generated fixtures are in $qaRoot"
}
finally {
  foreach ($process in @($nextProcess, $aiProcess)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  if ($pgStartedHere) {
    & $pgCtl stop -D $dbData -m fast -w *> $null
  }
}
