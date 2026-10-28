<#
============================================================================
 run-real-all-functions.ps1 - Run the full REAL "all functions" suite on
 learnace.tech with a single command + automatic pre-checks.
 (ASCII-ONLY VERSION - safe to save with any encoding, no BOM needed)
============================================================================
 Suites to run (5 files - every suite self-gates: skips with a reason
 when its preconditions are not met):

  1) team-signin-admin-visibility   [TEAM-SIGNIN-REAL]
     Core: sign in (register) -> log in -> data visible in /admin
     for the 3-member team.

  2) team-full-journey              [TEAM-JOURNEY-REAL]
     Full journey: register -> login -> upload own-name resume
     -> AI analysis (wait up to 90s for real result) -> create job
     -> /admin -> logout -> protected route must be gated.

  3) team-auth-functions-real       [TEAM-AUTHF-REAL]
     Auth functions: sign-in page structure, wrong password,
     unknown email, empty fields, forgot-password (account probe),
     duplicate register (proves account exists), weak password
     (password policy), non-existent URL behavior.

  4) team-admin-functions-real      [TEAM-ADMF-REAL]
     Deep /admin functions: gate before login, all 7 tabs,
     System Overview + 7/30-day switch, user search in Users tab,
     Analysis + Audit log, then logout and /admin gated again.

  5) team-pipeline-real             [TEAM-PIPE-REAL]
     FULL PIPELINE with the team's REAL resume files (folder resume\):
     upload real resume -> select job (JOB_MATCH) -> run AI analysis
     and WAIT UP TO 300s for the real result (poll + timeline evidence)
     -> verify score / strengths / improvements -> analysis history
     -> /jobs create a job position (CRUD) -> extra functions:
     direct /resumes/upload, invalid-file upload must be rejected,
     /privacy page.
     NOTE: put the 3 real resume PDFs into <project>\resume\ and the
     suite uploads those real files (matched by first name in filename);
     if the folder is missing it falls back to generated fixtures.

 Approx duration: 25-40 min (real site behind a Cloudflare tunnel, 1 worker,
 each PIPE test waits up to 300s for the real AI analysis result)

 How to run (from any folder):
   powershell -ExecutionPolicy Bypass -File "C:\path\to\run-real-all-functions.ps1"
   powershell -ExecutionPolicy Bypass -File "C:\path\to\run-real-all-functions.ps1" -NoHeaded

 After the run, open the evidence report:
   npx playwright show-report

 Notes:
   - This script contains NO non-ASCII characters on purpose, so it
     parses correctly regardless of file encoding (with or without BOM).
   - Do NOT run "npx playwright test" without file filters when
     MOCK_API=false - the MOCK suites (TC-*) would hit the real site
     with fake accounts and fail for the wrong reason.
     (This script selects the REAL suite files for you.)
============================================================================
#>
param(
  [switch]$NoHeaded
)

 $ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# 1) Find the project root folder (works from any current directory)
# ---------------------------------------------------------------------------
function Find-ProjectRoot {
  $searchBases = @()
  $searchBases += (Get-Location).Path
  $searchBases += "$HOME\Downloads"
  $searchBases += "$HOME\Documents"
  $searchBases += "$HOME\Desktop"

  $found = @()
  foreach ($base in $searchBases) {
    if (-not (Test-Path -LiteralPath $base)) { continue }
    $configHere = Join-Path $base 'playwright.config.ts'
    if (Test-Path -LiteralPath $configHere) { $found += $base }

    $subDirs = Get-ChildItem -LiteralPath $base -Recurse -Depth 4 -Filter 'playwright.config.ts' `
      -ErrorAction SilentlyContinue
    foreach ($item in $subDirs) { $found += $item.DirectoryName }
  }

  $found = $found | Select-Object -Unique
  foreach ($root in $found) {
    $marker = Join-Path $root 'tests\e2e\registration.spec.ts'
    if (Test-Path -LiteralPath $marker) { return $root }
  }
  return $null
}

 $projectRoot = Find-ProjectRoot
if ($null -eq $projectRoot) {
  Write-Host ''
  Write-Host '[X] Project folder not found on this machine (needs playwright.config.ts and tests\e2e\registration.spec.ts)' -ForegroundColor Red
  exit 1
}
Set-Location -LiteralPath $projectRoot
Write-Host "[i] Project folder: $projectRoot"

# ---------------------------------------------------------------------------
# 2) Dependencies
# ---------------------------------------------------------------------------
if (-not (Test-Path '.\node_modules\@playwright\test')) {
  Write-Host '[i] node_modules missing -> running npm install first (1-2 min)...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[X] npm install failed - check your internet connection and try again' -ForegroundColor Red
    exit 1
  }
}

# ---------------------------------------------------------------------------
# 3) Team resume files for the 3 members (journey uploads these exact files)
# ---------------------------------------------------------------------------
if (-not (Test-Path '.\fixtures\files\resume-Kanyarat-Patthanan.pdf')) {
  Write-Host '[i] Team resume files missing -> running node scripts/gen-fixtures.js'
  node scripts/gen-fixtures.js
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[X] Fixture generation failed - run this command yourself and inspect the error: npm run gen:fixtures' -ForegroundColor Red
    exit 1
  }
}
Write-Host '[OK] Team resume files ready (fixtures/files/)'
if (Test-Path '.\resume') {
  Write-Host '[OK] resume\ folder found - PIPE-REAL will upload the real team resume files from it'
} else {
  Write-Host '[i] No resume\ folder - PIPE-REAL will fall back to generated fixtures (fixtures/files/)'
}

# ---------------------------------------------------------------------------
# 4) PRE-CHECK: https://learnace.tech must be online before we start
# ---------------------------------------------------------------------------
Write-Host '[i] Checking that https://learnace.tech is online...'
try {
  $resp = Invoke-WebRequest -Uri 'https://learnace.tech' -Method Head `
    -TimeoutSec 25 -UseBasicParsing
  Write-Host ("[OK] Site responded with HTTP status {0}" -f [int]$resp.StatusCode) -ForegroundColor Green
}
catch {
  Write-Host ''
  Write-Host '[X] BLOCKED: https://learnace.tech is not reachable from this machine right now' -ForegroundColor Red
  Write-Host ('    Reason: ' + $_.Exception.Message)
  Write-Host '    Per the framework rule (cannot run = BLOCKED + reason), we do not run tests that would fail for the wrong reason.'
  Write-Host '    Next step: wait until the site owner brings the server up (site is behind a Cloudflare tunnel), then run this script again.'
  exit 1
}

# ---------------------------------------------------------------------------
# 5) PRE-CHECK: .env must define the 3 team passwords (gate for every REAL suite)
# ---------------------------------------------------------------------------
 $requiredKeys = @('TEAM_KANYARAT_PASSWORD', 'TEAM_PHIRAPHAT_PASSWORD', 'TEAM_VARIN_PASSWORD')
if (-not (Test-Path '.\.env')) {
  Write-Host '[X] BLOCKED: .env file not found in the project folder' -ForegroundColor Red
  Write-Host '    Fix: create .env with MOCK_API=false + the 3 team passwords (see node scripts/check-env.js --init)'
  exit 1
}
 $envContent = Get-Content '.\.env' -Raw
 $missing = @()
foreach ($key in $requiredKeys) {
  if ($envContent -notmatch ("(?m)^\s*{0}\s*=\s*""?[^""\r\n]+""?" -f [regex]::Escape($key))) {
    $missing += $key
  }
}
if ($missing.Count -gt 0) {
  Write-Host ('[X] BLOCKED: .env does not define all team passwords - missing: ' + ($missing -join ', ')) -ForegroundColor Red
  Write-Host '    Values containing # or $ must always be wrapped in double quotes "..." (otherwise dotenv truncates the value)'
  Write-Host '    Detailed check: node scripts/check-env.js'
  exit 1
}
Write-Host '[OK] .env defines the 3 team passwords'

# ---------------------------------------------------------------------------
# 6) Force real mode for this session only (does not modify the .env file)
# ---------------------------------------------------------------------------
 $env:MOCK_API = 'false'
Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
Write-Host '[OK] This session: MOCK_API=false (running against real learnace.tech) - applies to this PowerShell window only'

# ---------------------------------------------------------------------------
# 7) Run all 5 REAL suite files (single command - every suite already self-gates)
# ---------------------------------------------------------------------------
 $npxArgs = @(
  'playwright', 'test',
  'team-signin-admin-visibility',
  'team-full-journey',
  'team-auth-functions-real',
  'team-admin-functions-real',
  'team-pipeline-real',
  '--project=Desktop Chrome',
  '--workers=1',
  '--reporter=list,html'
)
if (-not $NoHeaded) { $npxArgs += '--headed' }

Write-Host ''
Write-Host "[i] Running: npx $($npxArgs -join ' ')"
Write-Host '[i] 5 suites total: SIGNIN-REAL (3 cases) + JOURNEY-REAL (3) + AUTHF-REAL (8) + ADMF-REAL (6) + PIPE-REAL (5) = 25 cases'
Write-Host '[i] Approx 25-40 min - the browser will open so you can watch every step (do not close auto-opened windows)'
Write-Host '[i] PIPE-REAL uploads the REAL resume files from the resume\ folder if present (else generated fixtures)'
Write-Host '[i] PIPE-REAL waits up to 300s per analysis for the real AI result - be patient, do not close the browser'
Write-Host ''
& npx @npxArgs
 $exitCode = $LASTEXITCODE

# ---------------------------------------------------------------------------
# 8) Summary
# ---------------------------------------------------------------------------
Write-Host ''
if ($exitCode -eq 0) {
  Write-Host '[OK] All passed - open the evidence report with: npx playwright show-report' -ForegroundColor Green
  Write-Host '     Evidence you should see in the report: REAL-1..10 (journey), AUTHF-1..8, ADMF-1..6, PIPE-*'
}
else {
  Write-Host '[!] Some cases did not pass - open the report to see evidence attached to every case (real system messages + dumps + screenshots):' -ForegroundColor Yellow
  Write-Host '    npx playwright show-report'
  Write-Host '    How to read: a case failing with "BLOCKED"/"button not found" means real conditions/DOM differ from expectations.'
  Write-Host '                 Always read the attached dump first - never guess (framework rule: conclusions must not exceed evidence).'
}
exit $exitCode