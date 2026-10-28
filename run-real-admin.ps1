
<#
.SYNOPSIS
  Run real LearnAce team sign-in and admin visibility tests.

.DESCRIPTION
  Checks project files, dependencies, website availability and required
  team password keys before running the REAL Playwright test suite.
#>

param(
    [switch]$IncludeJourney,
    [switch]$NoHeaded
)

$ErrorActionPreference = 'Stop'

# 1. Find the project root.
function Find-ProjectRoot {
    $searchBases = @(
        $PSScriptRoot
        (Get-Location).Path
        "$HOME\Downloads"
        "$HOME\Documents"
        "$HOME\Desktop"
    ) | Select-Object -Unique

    # Check the supplied directories first.
    foreach ($base in $searchBases) {
        if (-not (Test-Path -LiteralPath $base)) {
            continue
        }

        $config = Join-Path $base 'playwright.config.ts'
        $marker = Join-Path $base 'tests\e2e\registration.spec.ts'

        if ((Test-Path -LiteralPath $config) -and
            (Test-Path -LiteralPath $marker)) {
            return $base
        }
    }

    # Search for a project if it is nested inside a search directory.
    foreach ($base in $searchBases) {
        if (-not (Test-Path -LiteralPath $base)) {
            continue
        }

        $configs = Get-ChildItem -LiteralPath $base `
            -Filter 'playwright.config.ts' -File -Recurse `
            -ErrorAction SilentlyContinue

        foreach ($item in $configs) {
            if ($item.FullName -match '[\\/]node_modules[\\/]') {
                continue
            }

            $root = $item.DirectoryName
            $marker = Join-Path $root 'tests\e2e\registration.spec.ts'

            if (Test-Path -LiteralPath $marker) {
                return $root
            }
        }
    }

    return $null
}

$projectRoot = Find-ProjectRoot

if ($null -eq $projectRoot) {
    Write-Host '[BLOCKED] Project root not found.' -ForegroundColor Red
    Write-Host 'Expected playwright.config.ts and tests\e2e\registration.spec.ts.'
    exit 1
}

Set-Location -LiteralPath $projectRoot

Write-Host "[INFO] Project root: $projectRoot" -ForegroundColor Cyan

# 2. Check dependencies.
$playwrightPackage = Join-Path $projectRoot 'node_modules\@playwright\test'

if (-not (Test-Path -LiteralPath $playwrightPackage)) {
    Write-Host '[INFO] Installing project dependencies...'
    npm install

    if ($LASTEXITCODE -ne 0) {
        Write-Host '[BLOCKED] npm install failed.' -ForegroundColor Red
        exit 1
    }
}

# 3. Check that the real website responds.
$siteUrl = 'https://learnace.tech'

Write-Host "[INFO] Checking website: $siteUrl"

try {
    $response = Invoke-WebRequest -Uri $siteUrl `
        -Method Head -TimeoutSec 25 -UseBasicParsing

    Write-Host (
        '[OK] Website responded with HTTP {0}' -f
        [int]$response.StatusCode
    ) -ForegroundColor Green
}
catch {
    Write-Host '[BLOCKED] Website pre-check failed.' -ForegroundColor Red
    Write-Host ('Reason: ' + $_.Exception.Message)
    Write-Host 'Check connectivity and website protection before retrying.'
    exit 1
}

# 4. Check required team password keys without displaying their values.
$envFile = Join-Path $projectRoot '.env'

$requiredKeys = @(
    'TEAM_KANYARAT_PASSWORD'
    'TEAM_PHIRAPHAT_PASSWORD'
    'TEAM_VARIN_PASSWORD'
)

if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Host '[BLOCKED] Project .env file not found.' -ForegroundColor Red
    exit 1
}

$envContent = Get-Content -LiteralPath $envFile -Raw
$missing = @()

foreach ($key in $requiredKeys) {
    $pattern = '(?m)^\s*{0}\s*=\s*"?[^"\r\n]+"?\s*$' -f
        [regex]::Escape($key)

    if ($envContent -notmatch $pattern) {
        $missing += $key
    }
}

if ($missing.Count -gt 0) {
    Write-Host '[BLOCKED] Required password keys are missing or empty:' `
        -ForegroundColor Red

    $missing | ForEach-Object { Write-Host " - $_" }
    exit 1
}

Write-Host '[OK] Required password keys are present.' `
    -ForegroundColor Green

# 5. Configure this PowerShell session for real tests.
$env:MOCK_API = 'false'
Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue

Write-Host '[INFO] MOCK_API=false for this session.'
Write-Host '[INFO] BASE_URL cleared; the project configuration must use the real site.'

# 6. Run the real team sign-in/admin visibility tests.
$npxArgs = @(
    'playwright'
    'test'
    'team-signin-admin-visibility'
    '--grep'
    'TEAM-SIGNIN-REAL'
    '--project=Desktop Chrome'
    '--workers=1'
    '--reporter=list,html'
)

if (-not $NoHeaded) {
    $npxArgs += '--headed'
}

Write-Host ''
Write-Host "[INFO] Running: npx $($npxArgs -join ' ')"
Write-Host '[INFO] Flow: register -> log in -> /admin -> verify team users'
Write-Host ''

& npx @npxArgs
$exitCode = $LASTEXITCODE

# 7. Optionally run the full journey suite.
if ($IncludeJourney) {
    Write-Host ''
    Write-Host '[INFO] Running TEAM-JOURNEY-REAL...'

    $journeyArgs = @(
        'playwright'
        'test'
        'team-full-journey'
        '--grep'
        'TEAM-JOURNEY-REAL'
        '--project=Desktop Chrome'
        '--workers=1'
        '--reporter=list,html'
    )

    if (-not $NoHeaded) {
        $journeyArgs += '--headed'
    }

    & npx @journeyArgs
    $journeyExitCode = $LASTEXITCODE

    if ($journeyExitCode -ne 0) {
        $exitCode = $journeyExitCode
    }
}

# 8. Summarize the result.
Write-Host ''

if ($exitCode -eq 0) {
    Write-Host '[OK] Selected tests passed.' -ForegroundColor Green
}
else {
    Write-Host '[FAIL] One or more tests failed.' -ForegroundColor Yellow
    Write-Host 'Review the Playwright report and test output.'
    Write-Host 'HTTP 401/403 on /admin may indicate insufficient account permissions.'
}

Write-Host 'To view the HTML report, run: npx playwright show-report'

exit $exitCode
