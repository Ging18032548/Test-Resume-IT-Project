<#
============================================================================
 run-real-admin.ps1 — รัน "sign in → log in → แสดงใน learnace.tech/admin"
 ด้วยบัญชีทีมจริง 3 คน แบบคำสั่งเดียว พร้อมตรวจเงื่อนไขทุกข้อให้อัตโนมัติ
============================================================================
 สิ่งที่สคริปต์ทำเอง (evidence-first — หยุดพร้อมเหตุผลถ้าอะไรไม่ครบ):
   1) หาโฟลเดอร์รากของโปรเจกต์อัตโนมัติ (รันจากที่ไหนก็ได้)
   2) ตรวจ node_modules — ไม่มี = npm install ให้
   3) ตรวจว่า learnace.tech ออนไลน์จริง (ถ้าเว็บล่ม = BLOCKED พร้อมเหตุผล
      จะได้ไม่ต้องเดาว่าทำไมเทสต์ fail)
   4) ตรวจ .env ว่าตั้ง TEAM_KANYARAT_PASSWORD / TEAM_PHIRAPHAT_PASSWORD /
      TEAM_VARIN_PASSWORD ครบ (ไม่ครบ = BLOCKED ตามกฎเฟรมเวิร์ก)
   5) ตั้ง MOCK_API=false เฉพาะรอบนี้ (ไม่แก้ไฟล์ .env — ปิด session แล้วค่าหาย)
      และล้าง BASE_URL ให้ default ชี้ https://learnace.tech
   6) รันชุด REAL: sign in (สมัคร) → log in → /admin ของทีม 3 คน
      - ทำงาน 1 worker (ส่งต่อเว็บจริงหลัง Cloudflare tunnel แบบนุ่มนวล)
      - เก็บหลักฐานทุกขั้นลง HTML report (แนบในแต่ละเทสต์)

 วิธีใช้ (รันจากที่ไหนก็ได้):
   powershell -ExecutionPolicy Bypass -File "C:\path\to\run-real-admin.ps1"
   powershell -ExecutionPolicy Bypass -File "C:\path\to\run-real-admin.ps1" -IncludeJourney
   powershell -ExecutionPolicy Bypass -File "C:\path\to\run-real-admin.ps1" -NoHeaded

   -IncludeJourney = รันชุด TEAM-JOURNEY-REAL (ครบทุก function: อัปโหลด resume
                     ชื่อตัวเอง → วิเคราะห์ → ประวัติ → jobs → /admin → logout) เพิ่มด้วย
   -NoHeaded       = รันแบบ headless (ปกติจะเปิดหน้าต่างเบราว์เซอร์ให้ดูสด)

 หลังรันเสร็จดูรายงานหลักฐานทุกขั้น:
   npx playwright show-report

 หมายเหตุ:
   - ถ้าข้อความภาษาไทยแสดงเพี้ยน ให้บันทึกไฟล์นี้ด้วย Encoding: "UTF-8 with BOM"
   - ผลที่คาดหวังเมื่อทุกอย่างพร้อม: 3 passed (ชุด REAL) — ถ้า /admin ไม่แสดงข้อมูล
     เทสต์จะ FAIL พร้อมสถานะ HTTP จริงทุก call (ส่วนใหญ่ = บัญชียังไม่มี role ADMIN
     ต้องขอเจ้าของระบบเปลี่ยน role เป็น ADMIN)
============================================================================
#>
param(
  [switch]$IncludeJourney,
  [switch]$NoHeaded
)

 $ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# 1) หาโฟลเดอร์รากของโปรเจกต์ (มี playwright.config.ts + tests\e2e\registration.spec.ts)
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
  Write-Host '[X] หาโฟลเดอร์โปรเจกต์ไม่เจอบนเครื่องนี้ (ต้องมี playwright.config.ts และ tests\e2e\registration.spec.ts)' -ForegroundColor Red
  exit 1
}
Set-Location -LiteralPath $projectRoot
Write-Host "[i] โฟลเดอร์โปรเจกต์: $projectRoot"

# ---------------------------------------------------------------------------
# 2) dependencies
# ---------------------------------------------------------------------------
if (-not (Test-Path '.\node_modules\@playwright\test')) {
  Write-Host '[i] ยังไม่มี node_modules -> npm install ก่อน (1-2 นาที)...'
  npm install
  if ($LASTEXITCODE -ne 0) {
    Write-Host '[X] npm install ล้มเหลว — ตรวจอินเทอร์เน็ตแล้วลองใหม่' -ForegroundColor Red
    exit 1
  }
}

# ---------------------------------------------------------------------------
# 3) PRE-CHECK: learnace.tech ต้องออนไลน์จริงก่อน (เว็บจริงอยู่หลัง Cloudflare
#    tunnel — ถ้าเครื่องต้นทางปิด เว็บจะเข้าไม่ได้ และเทสต์จะ fail ทั้งชุดโดยใช่เหตุ)
# ---------------------------------------------------------------------------
Write-Host '[i] ตรวจว่า https://learnace.tech ออนไลน์...'
try {
  $resp = Invoke-WebRequest -Uri 'https://learnace.tech' -Method Head `
    -TimeoutSec 25 -UseBasicParsing
  Write-Host ("[OK] เว็บตอบสนอง สถานะ HTTP {0}" -f [int]$resp.StatusCode) -ForegroundColor Green
}
catch {
  Write-Host ''
  Write-Host '[X] BLOCKED: เข้า https://learnace.tech ไม่ได้จากเครื่องนี้ตอนนี้' -ForegroundColor Red
  Write-Host ('    เหตุผล: ' + $_.Exception.Message)
  Write-Host '    ตามกฎเฟรมเวิร์ก (เคสรันไม่ได้ = BLOCKED + เหตุผล) จึงไม่รันเทสต์ให้ fail โดยใช่เหตุ'
  Write-Host '    วิธีต่อ: รอเจ้าของระบบเปิดเซิร์ฟเวอร์ (เว็บหลัง Cloudflare tunnel) แล้วรันสคริปต์นี้ใหม่'
  exit 1
}

# ---------------------------------------------------------------------------
# 4) PRE-CHECK: .env ต้องตั้งรหัสผ่านทีม 3 คนครบ (เงื่อนไข gate ของชุด REAL)
# ---------------------------------------------------------------------------
 $requiredKeys = @('TEAM_KANYARAT_PASSWORD', 'TEAM_PHIRAPHAT_PASSWORD', 'TEAM_VARIN_PASSWORD')
if (-not (Test-Path '.\.env')) {
  Write-Host '[X] BLOCKED: ไม่พบไฟล์ .env ในโฟลเดอร์โปรเจกต์' -ForegroundColor Red
  Write-Host '    วิธีแก้: สร้าง .env แล้วเพิ่ม TEAM_KANYARAT_PASSWORD / TEAM_PHIRAPHAT_PASSWORD / TEAM_VARIN_PASSWORD'
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
  Write-Host ('[X] BLOCKED: .env ยังไม่ตั้งรหัสผ่านทีมครบ — ขาด: ' + ($missing -join ', ')) -ForegroundColor Red
  Write-Host '    ค่าที่มีอักขระ # หรือ $ ต้องครอบด้วยเครื่องหมายคำพูด "..." เสมอ (มิฉะนั้น dotenv จะตัดค่าทิ้ง)'
  exit 1
}
Write-Host '[OK] .env ตั้งรหัสผ่านทีม 3 คนครบ'

# ---------------------------------------------------------------------------
# 5) ตั้งโหมดจริงเฉพาะรอบนี้ (ไม่แก้ไฟล์ .env):
#    MOCK_API=false และล้าง BASE_URL ให้ config default ชี้ https://learnace.tech
# ---------------------------------------------------------------------------
 $env:MOCK_API = 'false'
Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
Write-Host '[OK] โหมดนี้: MOCK_API=false (รันเทสต์กับ learnace.tech จริง) — ค่านี้ใช้เฉพาะหน้าต่าง PowerShell นี้'

# ---------------------------------------------------------------------------
# 6) รันชุด REAL
# ---------------------------------------------------------------------------
 $npxArgs = @(
  'playwright', 'test',
  'team-signin-admin-visibility',
  '--grep', 'TEAM-SIGNIN-REAL',
  '--project=Desktop Chrome',
  '--workers=1',
  '--reporter=list,html'
)
if (-not $NoHeaded) { $npxArgs += '--headed' }

Write-Host ''
Write-Host "[i] รันคำสั่ง: npx $($npxArgs -join ' ')"
Write-Host '[i] ขั้นตอนต่อบัญชี: sign in (สมัคร) -> log in -> /admin — เก็บหลักฐานทุกขั้นในรายงาน'
Write-Host ''
& npx @npxArgs
 $exitCode = $LASTEXITCODE

# ---------------------------------------------------------------------------
# 7) รันชุด journey เพิ่ม (ถ้าสั่ง -IncludeJourney)
# ---------------------------------------------------------------------------
if ($IncludeJourney) {
  Write-Host ''
  Write-Host '[i] รันชุด TEAM-JOURNEY-REAL (ครบทุก function) ต่อ...'
  $journeyArgs = @(
    'playwright', 'test',
    'team-full-journey',
    '--grep', 'TEAM-JOURNEY-REAL',
    '--project=Desktop Chrome',
    '--workers=1',
    '--reporter=list,html'
  )
  if (-not $NoHeaded) { $journeyArgs += '--headed' }
  & npx @journeyArgs
  if ($LASTEXITCODE -ne 0) { $exitCode = $LASTEXITCODE }
}

Write-Host ''
if ($exitCode -eq 0) {
  Write-Host '[OK] ผ่านทั้งหมด — เปิดรายงานหลักฐานด้วย: npx playwright show-report' -ForegroundColor Green
}
else {
  Write-Host '[!] มีเคสไม่ผ่าน — เปิดรายงานดูหลักฐาน (HTTP status ทุก call ของ /api/admin/** ถูกแนบไว้):' -ForegroundColor Yellow
  Write-Host '    npx playwright show-report'
  Write-Host '    ถ้า fail ที่ขั้น /admin ด้วย 401/403 = บัญชียังไม่มี role ADMIN บนระบบจริง (ต้องขอเจ้าของระบบเปลี่ยน role)'
}
exit $exitCode