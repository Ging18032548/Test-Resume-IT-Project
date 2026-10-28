# LearnAce Automation — Full-Stack Automated Testing

ชุดทดสอบอัตโนมัติ (E2E + API + Database) สำหรับ **https://learnace.tech**
(AI CV Analyzer) ด้วย **Playwright + TypeScript** — สร้างตาม MASTER PROMPT
"Full-Stack Automated Testing" พร้อมหลักการ:

- 🔐 **Authentication-first** — flow ที่ต้องยืนยันตัวตนเริ่มจาก Sign In เสมอ
- 🧱 **Mocked Persistence** — `page.route()` ดัก API ทุกเส้น ตอบด้วย envelope จริง
  `{ success, message, data }` · **ไม่มีข้อมูลใดเข้าฐานข้อมูลจริง** (state ในหน่วยความจำ)
- 📱 **5 Device Projects** — Desktop Chrome / Firefox / Safari + Mobile Chrome (Pixel 5)
  + Mobile Safari (iPhone 12)
- 📸 **Media & Report** — `screenshot: 'only-on-failure'`, `video: 'retain-on-failure'`,
  `trace: 'retain-on-failure'`, **HTML Report พร้อม attachment ทุกชนิด**
- 🗄️ **Database เป็น READ-ONLY + ไม่เดา schema** — ค้นจาก `information_schema` เท่านั้น
- 🧾 **ความโปร่งใส** — ทุก endpoint/test มีสถานะหลักฐานกำกับ; การ skip ทุกครั้งมีเหตุผล BLOCKED

## โครงสร้างโปรเจกต์

```text
learnace-automation/
├── tests/
│   ├── e2e/                          # E2E (Mocked Persistence อัตโนมัติ)
│   │   ├── website-access.spec.ts    # TC-ACC-001..007 หน้าสาธารณะ + guards
│   │   ├── registration.spec.ts      # TC-REG-001..008 สมัครสมาชิก + password policy
│   │   ├── authentication.spec.ts    # TC-AUTH-001..007 + REAL (เงื่อนไขบัญชีจริง)
│   │   ├── session.spec.ts           # TC-SES-001..004 logout/protected
│   │   ├── dashboard.spec.ts         # TC-DSH-001..010 upload→analyze→radar→history
│   │   └── admin-analytics.spec.ts   # TC-ADM-001..007 /admin ทั้งหมด
│   ├── api/
│   │   └── api-validation.spec.ts    # TC-API-001..009 HTTP จริง (ไม่ผ่าน mock)
│   └── database/
│       └── data-integrity.spec.ts    # TC-DB-001..004 (BLOCKED จนกว่าจะมี DATABASE_URL)
├── pages/                            # Page Object Model
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   ├── RegistrationPage.ts
│   ├── DashboardPage.ts
│   └── AdminDashboardPage.ts
├── fixtures/
│   ├── test-fixtures.ts              # mock API router (stateful) + authedPage fixture
│   ├── test-data.ts                  # credentials/env/ไฟล์ fixture ทั้งหมด
│   └── files/                        # สร้างด้วย npm run gen:fixtures (gitignored)
├── helpers/
│   ├── api-helper.ts                 # envelope assertions (TOKEN_REQUIRED ฯลฯ)
│   ├── database-helper.ts            # read-only + schema discovery + SQL guard
│   └── test-data-factory.ts          # ข้อมูลไม่ซ้ำต่อรัน + สร้างไฟล์ชั่วคราว + cleanup
├── config/config.ts                  # endpoints พร้อมสถานะหลักฐานทุกเส้น
├── scripts/
│   ├── mock-app-server.js            # เว็บแอปจำลอง (in-memory) สะท้อนหลักฐานจริง
│   └── gen-fixtures.js               # สร้าง PDF จริง/ปลอม/เกินขนาด
├── docs/                             # เอกสารทั้งชุด (ดูตารางด้านล่าง)
├── reports/                          # test-results.json + db-inventory (เมื่อรัน)
├── playwright.config.ts              # 5 projects + media + HTML report
├── .env.example                      # template — ห้ามใส่ของจริง
└── README.md
```

เอกสารใน `docs/`:

| ไฟล์ | เนื้อหา |
|---|---|
| `website-inventory.md` | Phase 1-2 — ฟังก์ชัน/route/API/Tech stack พร้อมหลักฐานทุกข้อ |
| `test-plan.md` | Phase 3 — Test Case Matrix 60 เคส + เทคนิค EP/BVA/DT |
| `database-mapping.md` | Phase 4 — mapping แบบไม่เดา + แผนเปิดใช้ DB tests |
| `test-summary.md` | Phase 6 — ผลรันจริง 180 เทสต์ + execution log |
| `database-validation-report.md` | Phase 6 — สถานะ BLOCKED อย่างเป็นทางการ |
| `bug-report.md` | Phase 7 — BUG-001..003 + ข้อสังเกต + ปัญหาเฟรมเวิร์กที่แก้แล้ว |

## การติดตั้ง (Windows PowerShell)

```powershell
# 1) เข้าโฟลเดอร์โปรเจกต์
cd learnace-automation

# 2) ติดตั้ง dependencies
npm install

# 3) ติดตั้งเบราว์เซอร์ทั้งหมด (Chromium + Firefox + WebKit)
npx playwright install

# 4) สร้างไฟล์ fixture สำหรับทดสอบอัปโหลด
npm run gen:fixtures

# 5) สร้างไฟล์ .env จาก template แล้วแก้ค่าตามจริง
Copy-Item .env.example .env
notepad .env
```

ค่าใน `.env` ที่สำคัญ:

| ตัวแปร | ความหมาย |
|---|---|
| `BASE_URL` | ปลายทางทดสอบ — `https://learnace.tech` (เว็บจริง) หรือ localhost (แอปจำลอง) |
| `MOCK_API` | `true` = ดัก API ในเบราว์เซอร์ (ไม่แตะ DB จริง) — **ค่าเริ่มต้น** |
| `TEST_EMAIL` / `TEST_PASSWORD` | บัญชี QA ที่ได้รับอนุญาต (เว้นว่าง = เทสต์กลุ่ม REAL ถูกรายงาน BLOCKED) |
| `ALLOW_REGISTRATION_TEST` | ต้อง `true` เท่านั้นจึงสมัครบัญชีจริงบนระบบเป้าหมาย |
| `DATABASE_URL` | read-only connection ชี้ QA/Staging (เว้นว่าง = DB tests BLOCKED) |

## การรันทดสอบ (Windows PowerShell)

```powershell
# ---- โหมดยืนยันเฟรมเวิร์ก (ไม่แตะระบบจริงเลย — แอปจำลองสตาร์ตให้อัตโนมัติ) ----
$env:BASE_URL = "http://127.0.0.1:4310"
npm test                                  # ครบทุก project ที่ติดตั้งไว้

# ---- โหมดเว็บจริง (learnace.tech) — ใช้บัญชี QA ที่ได้รับอนุญาตเท่านั้น ----
$env:BASE_URL = "https://learnace.tech"
npm test

# ---- เลือกเฉพาะชั้น ----
npm run test:e2e                          # เฉพาะ E2E
npm run test:api                          # เฉพาะ API (HTTP จริง)
npm run test:db                           # เฉพาะ Database (BLOCKED จนมี DATABASE_URL)

# ---- เลือกอุปกรณ์ ----
npm run test:chrome                       # Desktop Chrome
npm run test:firefox                      # Desktop Firefox
npm run test:safari                       # Desktop Safari (WebKit)
npm run test:mobile-chrome                # Mobile Chrome (Pixel 5)
npm run test:mobile-safari                # Mobile Safari (iPhone 12)

# ---- แบบเห็นหน้าจอ ----
npm run test:headed

# ---- ตรวจ type ก่อนรัน ----
npm run typecheck
```

## การดูรายงาน

```powershell
# HTML Report (screenshot/video/trace ของเคสที่ fail ฝังอยู่ในไฟล์เดียว)
npm run report
# หากพอร์ต 9323 ถูกใช้อยู่:
npx playwright show-report playwright-report --port 9324

# ตัวเลขสรุปจาก JSON
Get-Content reports/test-results.json | ConvertFrom-Json | Select-Object stats
```

เมื่อรันเสร็จด้วย config ปกติ HTML Report จะ **เปิดในเบราว์เซอร์เอง** (`open: 'always'`)

## Selector Calibration (สำคัญสำหรับโหมดเว็บจริง)

หน้าหลัง login ของ learnace.tech ยังไม่เคยถูกแคป DOM จริง (ต้องมีบัญชี QA)
Locator ทั้งหมดจึงเป็นแบบ multi-fallback เมื่อรันบนเว็บจริงแล้วเจอ selector ไม่ตรง
ให้แคป DOM จริงแล้วปรับ POM ที่เกี่ยวข้อง:

```powershell
npx playwright codegen https://learnace.tech/dashboard     # ต้องมีบัญชี QA ล็อกอิน
npx playwright codegen https://learnace.tech/register      # หน้าสาธารณะ — แคปได้ทันที
```

## ข้อจำกัดที่รายงานไว้ตรงไปตรงมา

1. ผลรันที่แนบมา (165 passed / 0 failed / 15 blocked) เป็นผลจาก **mock-app-server**
   เพราะสภาพแวดล้อมสร้างชุดทดสอบเชื่อมต่อ learnace.tech ตรงไม่ได้ (curl timeout) —
   โครงสร้าง assertion อ้างหลักฐานจริงจากการโพรบ (ดู docs/website-inventory.md)
2. Database Assertions = **BLOCKED** ทั้งหมด (ยังไม่ได้รับ DATABASE_URL) —
   ห้ามตีความว่าผ่าน; รายละเอียดใน docs/database-validation-report.md
3. WebKit (Desktop/Mobile Safari) ต้องติดตั้งเบราว์เซอร์บนเครื่องผู้ใช้ก่อน
   (`npx playwright install`)

## ความปลอดภัยของข้อมูลทดสอบ

- ห้าม commit `.env` (gitignore แล้ว) — ห้ามใส่รหัสผ่านจริงลง source/report/log
- โหมด mock ไม่สร้างข้อมูลค้างใด ๆ (in-memory + ไฟล์ temp ถูกลบใน `finally`)
- โหมด live กับระบบจริง: ใช้บัญชี QA เท่านั้น ห้ามใช้ Production DB,
  ห้าม DROP/TRUNCATE (database-helper มี SQL guard + read-only session ซ้อนอีกชั้น)
