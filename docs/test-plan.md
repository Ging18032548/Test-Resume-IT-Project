# Test Plan — LearnAce (AI CV Analyzer) Full-Stack Testing

> Phase 3 ของ MASTER PROMPT — ครอบคลุมเฉพาะฟังก์ชันที่ตรวจพบจริง (อ้าง website-inventory.md)
> ไม่สร้างเทสต์สำหรับฟังก์ชันที่ไม่มีอยู่ / ไม่เดา endpoint ที่ยังไม่มีหลักฐาน

## 1. ขอบเขต (Scope)

**ในขอบเขต** — ฟังก์ชันที่ตรวจพบจากการสำรวจจริง:
1. Website Access: หน้าสาธารณะ, ลิงก์หลัก, route guards, SPA fallback, responsive
2. Registration: ฟอร์ม 4 ช่อง, password policy 4 ข้อ, mismatch, อีเมลซ้ำ, ช่องว่าง
3. Authentication: login สำเร็จ/ล้มเหลว (Decision Table), validation, Google OAuth presence
4. Session: logout, protected page หลัง logout, refresh หลังล้าง session
5. Dashboard (AI CV Analyzer): upload PDF → เลือกตำแหน่ง → วิเคราะห์ → คะแนนรวม +
   Radar Chart + Section Scores + จุดแข็ง + จุดปรับปรุง + ประวัติ + persistence
6. Admin Analytics: auth gate, สถิติ, success rate, ตาราง Users/Analysis, Audit log, BullMQ
7. API Validation: HTTP status, envelope `{success,message,code}`, TOKEN_REQUIRED,
   ENDPOINT_NOT_FOUND (เส้นที่ยืนยันแล้วว่าไม่มีจริง)
8. Database Integrity: schema discovery แบบ read-only (เปิดใช้เมื่อได้รับ DATABASE_URL)

**นอกขอบเขต** (ไม่มีหลักฐานว่ามีฟังก์ชันนี้ / ไม่ได้รับอนุญาต):
- Forgot Password flow เชิงลึก (มีเพียงลิงก์ — ยังโพรบหน้าจริงไม่ได้)
- Google OAuth end-to-end (ต้องใช้บัญชี Google จริง — นอกขอบเขต sandbox)
- Payment / Notification / Email ยืนยัน (ไม่พบหลักฐานว่ามี)
- Load/Performance testing หนัก (ตามข้อกำหนด "ไม่สร้างโหลดสูงเกินไป")

## 2. กลยุทธ์การทดสอบ (Test Strategy)

| ชั้น | เครื่องมือ | โหมด | ทำงานกับระบบจริงเมื่อใด |
|---|---|---|---|
| E2E UI | Playwright + POM | **Mocked Persistence** — `page.route()` ดักทุกเส้น `/api/**` ตอบด้วย envelope จริง, state อยู่ในหน่วยความจำ | เมื่อตั้ง `MOCK_API=false` + มีบัญชี QA (ห้ามกับ Production DB) |
| API | Playwright `request` (HTTP จริง ไม่ผ่าน mock) | ยิงตรงที่ `BASE_URL` | รันบนเครื่องผู้ใช้ = ยิง learnace.tech จริง |
| Database | DatabaseHelper (pg/mysql2 อัตโนมัติ) | **READ-ONLY session** + schema discovery จาก information_schema | เฉพาะเมื่อได้รับ `DATABASE_URL` |
| Cross-device | 5 Projects: Desktop Chrome/Firefox/Safari, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12) | ตาม config | ทันที |

**หลักการกำกับทั้งหมด** (ตาม MASTER PROMPT):
- ทุก endpoint ในโค้ดมีสถานะหลักฐานกำกับ (VERIFIED_LIVE_* / MOCK_ONLY / UNVERIFIED)
- ห้าม `waitForTimeout()` — ใช้ explicit assertions + auto-wait ทั้งหมด
- เทสต์ไม่พึ่งพาลำดับการรัน (fullyParallel, state ต่อเทสต์)
- การ skip ทุกครั้งมีเหตุผล BLOCKED แสดงในรายงาน (ไม่ปิดบังข้อผิดพลาด)
- Cleanup: ไฟล์ fixture ชั่วคราวถูกลบใน `finally` — mock state หายเองเมื่อจบ process

## 3. Test Case Matrix

รหัสโมดูล: ACC=Access, REG=Registration, AUTH=Authentication, SES=Session,
DSH=Dashboard, ADM=Admin, API=API, DB=Database
ประเภท: P=Positive, N=Negative, B=Boundary/Edge

| TC ID | โมดูล | สถานการณ์ | ประเภท | สคริปต์อัตโนมัติ | Database Assertion | หมายเหตุ |
|---|---|---|---|---|---|---|
| TC-ACC-001 | Access | เปิดหน้าแรกสำเร็จ + ฟอร์ม login แสดง | P | ✅ website-access.spec.ts | — | |
| TC-ACC-002 | Access | ลิงก์หลักครบ (Google/Register/Forgot) | P | ✅ website-access.spec.ts | — | |
| TC-ACC-003 | Access | /sign-in แสดงฟอร์มครบ | P | ✅ website-access.spec.ts | — | |
| TC-ACC-004 | Access | หน้าแรกไม่มี console error / failed request | N | ✅ website-access.spec.ts | — | Regression/non-functional |
| TC-ACC-005 | Access | /dashboard, /jobs, /resumes/upload ถูก guard เมื่อไม่ล็อกอิน | N | ✅ (parametrize 3 route) | — | Redirect/guard behavior |
| TC-ACC-006 | Access | URL ไม่มีจริง → แสดงหน้า login (ไม่มี 404) | B | ✅ (baseline BUG-001) | — | ล็อกพฤติกรรมจริงไว้ |
| TC-ACC-007 | Access | โหลดบน viewport มือถือ ไม่ overflow แนวนอน | B | ✅ (Mobile projects) | — | Responsive |
| TC-REG-001 | Registration | ฟอร์มครบ 4 ช่อง | P | ✅ registration.spec.ts | REG: ตาราง users (BLOCKED) | |
| TC-REG-002 | Registration | password checklist 4 ข้อแสดง | P | ✅ | — | หลักฐานจากหน้าจริง |
| TC-REG-003 | Registration | checklist ประเมิน real-time ถูกต้อง | B | ✅ | — | EP: มี/ไม่มี upper+lower+digit, >=8 |
| TC-REG-004 | Registration | รหัสผ่าน ≠ ยืนยัน → ปฏิเสธ | N | ✅ | — | |
| TC-REG-005 | Registration | สมัครสำเร็จ (Mock — ไม่เขียน DB จริง) | P | ✅ | REG insert (BLOCKED) | บนระบบจริงต้องเปิด ALLOW_REGISTRATION_TEST |
| TC-REG-006 | Registration | อีเมลซ้ำ → error (409) | N | ✅ (mock จำลอง) | Unique constraint (BLOCKED) | |
| TC-REG-007 | Registration | ช่องบังคับว่าง → ไม่ส่งฟอร์ม | N | ✅ | — | |
| TC-REG-008 | Registration | รหัสผ่านไม่ครบกติกา (ไม่มีตัวเลข) → ปฏิเสธ | N | ✅ | — | EP/BVA ของนโยบาย |
| TC-AUTH-001 | Auth | login ถูกต้อง → /dashboard | P | ✅ authentication.spec.ts | Session/token record (BLOCKED) | DT rule 1 |
| TC-AUTH-002 | Auth | รหัสผ่านผิด → error | N | ✅ | Login audit (BLOCKED/ไม่สมมติ) | DT rule 2 |
| TC-AUTH-003 | Auth | อีเมลไม่มีในระบบ → error | N | ✅ | — | DT rule 3 |
| TC-AUTH-004 | Auth | ช่องว่าง → validation กันส่ง | N | ✅ | — | DT rule 4 |
| TC-AUTH-005 | Auth | login สำเร็จแล้ว Dashboard แสดงข้อมูลผู้ใช้ | P | ✅ | — | /api/auth/me envelope |
| TC-AUTH-006 | Auth | ปุ่ม Google + ลิงก์ Forgot แสดง | P | ✅ | — | |
| TC-AUTH-007 | Auth | ลิงก์สมัครสมาชิกพาไป /register | P | ✅ | — | route จริงตามหลักฐาน |
| TC-AUTH-REAL-001/002 | Auth | บัญชีจริง: login สำเร็จ/รหัสผ่านผิด | P/N | ⏸ BLOCKED — ไม่มี TEST_EMAIL | — | skip พร้อมเหตุผลในรายงาน |
| TC-SES-001 | Session | logout → กลับหน้า login | P | ✅ session.spec.ts | Session invalidation (BLOCKED) | |
| TC-SES-002 | Session | หลัง logout เข้า protected ไม่ได้ | N | ✅ | — | |
| TC-SES-003 | Session | refresh หลังล้าง session → ไม่เห็นข้อมูลส่วนตัว | N | ✅ | — | |
| TC-SES-004 | Session | ไม่เคยล็อกอิน เปิด /jobs ตรง → guard | N | ✅ | — | |
| TC-DSH-001 | Dashboard | upload PDF ถูกต้อง → สำเร็จ | P | ✅ dashboard.spec.ts | resumes insert (BLOCKED) | |
| TC-DSH-002 | Dashboard | upload+เลือกงาน+วิเคราะห์ → คะแนน 82 + radar | P | ✅ | analyses insert (BLOCKED) | |
| TC-DSH-003 | Dashboard | แสดงจุดแข็ง + จุดปรับปรุงพร้อมเนื้อหาจริง | P | ✅ | — | |
| TC-DSH-004 | Dashboard | Section Scores ครบ 7 แกน | P | ✅ | — | |
| TC-DSH-005 | Dashboard | ประวัติการวิเคราะห์ ≥5 รายการ | P | ✅ | history query (BLOCKED) | |
| TC-DSH-006 | Dashboard | persistence หลัง refresh | B | ✅ | — | |
| TC-DSH-007 | Dashboard | ไฟล์ปลอม (.pdf แต่ไม่ใช่ PDF) → ปฏิเสธ | N | ✅ | — | ไฟล์สร้างรันต่อรัน |
| TC-DSH-008 | Dashboard | ไฟล์ >5MB (boundary ที่กำหนด) → ปฏิเสธ | B | ✅ | — | ลิมิต 5MB เป็นสมมติฐานที่ติดป้ายไว้ |
| TC-DSH-009 | Dashboard | JOB_MATCH analysis → ผลครบทุกส่วน | P | ✅ | — | |
| TC-DSH-010 | Dashboard | ไฟล์ PDF ไม่ซ้ำต่อรัน → journey สมบูรณ์ | P | ✅ | — | unique per run |
| TC-ADM-001 | Admin | /admin ก่อนล็อกอิน → auth gate | N | ✅ admin-analytics.spec.ts | — | |
| TC-ADM-002 | Admin | login → System Overview + การ์ดสถิติ | P | ✅ | — | |
| TC-ADM-003 | Admin | ค่าสถิติถูกต้องตาม payload (1,284 / 3,562) | P | ✅ | — | |
| TC-ADM-004 | Admin | ตาราง Users + ฟังก์ชันค้นหา | P | ✅ | — | |
| TC-ADM-005 | Admin | ตาราง Analysis + กรองสถานะ | P | ✅ | — | |
| TC-ADM-006 | Admin | Audit log แสดง | P | ✅ | audit log insert (BLOCKED) | |
| TC-ADM-007 | Admin | Service Status ระบุ BullMQ | P | ✅ | — | หลักฐาน tech stack |
| TC-API-001 | API | GET / → 200 มีเนื้อหา | P | ✅ api-validation.spec.ts | — | |
| TC-API-002..006 | API | 401 TOKEN_REQUIRED ครบ 5 เส้นที่โพรบจริง | N | ✅ | — | ล็อก envelope จริง |
| TC-API-004 | API | GET /api/analyses → 404 ENDPOINT_NOT_FOUND | B | ✅ | — | ยืนยันแล้วว่าเส้นไม่มีจริง |
| TC-API-007 | API | login payload ว่าง → 4xx พร้อม envelope | N | ✅ | — | |
| TC-API-008 | API | login ถูกต้อง → ได้ token | P | ✅ (mock/QA) | — | โหมด live ต้องมีบัญชีจริง |
| TC-API-009 | API | /api/analyses/:id มีจริงและถูกป้องกัน | B | ✅ | — | ต่างจาก collection |
| TC-DB-001 | DB | สถานะไม่มีสิทธิ์ → BLOCKED รายงานชัดเจน | N | ✅ (รายงาน BLOCKED) | — | ห้ามปลอมผล |
| TC-DB-002 | DB | เชื่อมต่อ read-only สำเร็จ | P | ⏸ BLOCKED | — | เปิดเมื่อมี DATABASE_URL |
| TC-DB-003 | DB | schema discovery จริง + บันทึก inventory | P | ⏸ BLOCKED | — | ไม่เดาชื่อตาราง |
| TC-DB-004 | DB | read-only guard ปฏิเสธคำสั่งเขียน | N | ⏸ BLOCKED | — | ความปลอดภัย |

## 4. เทคนิคการออกแบบเทสต์ที่ใช้

- **Equivalence Partitioning**: รหัสผ่าน (ผ่าน/ไม่ผ่านแต่ละกติกา), อีเมล (ถูก/ซ้ำ/ไม่มี/invalid),
  ไฟล์ (PDF จริง/ปลอม/เกินขนาด/ชนิดห้าม)
- **Boundary Value Analysis**: ความยาวรหัสผ่าน ≥8, ขนาดไฟล์ 5MB (เกิน/ไม่เกิน),
  viewport มือถือ vs desktop
- **Decision Table (DT-AUTH)**: email/password → {ถูก,ผิด,ว่าง} ครบ 4 rule
  → ผูกกับ TC-AUTH-001..004
- **Regression baseline**: TC-ACC-006 ล็อกพฤติกรรม SPA fallback จริง (ไม่ใช่พฤติกรรมอุดมคติ)

## 5. สภาพแวดล้อมและข้อมูลทดสอบ

- ไฟล์ fixture สร้างด้วย `npm run gen:fixtures` (PDF จริง 0.8KB / ปลอม / .exe / >5MB)
- อีเมลไม่ซ้ำต่อรันด้วย plus-addressing (`helpers/test-data-factory.ts`)
- Mock payloads รวมศูนย์ที่ `fixtures/test-fixtures.ts` + `scripts/mock-app-server.js`
- การรันบนระบบจริงต้องตั้งค่าตาม `.env.example` — ห้าม commit .env จริง

## 6. เกณฑ์เข้า/ออก (Entry / Exit Criteria)

**Entry**: ติดตั้ง deps + browsers สำเร็จ, `npx tsc --noEmit` ผ่าน, mock server เปิดได้
**Exit (ระดับ sandbox)**: ชุดที่รันได้จริงผ่าน 100% (0 failed), เทสต์ที่ BLOCKED
มีเหตุผลรายงานครบ, HTML Report สร้างแล้ว, ข้อจำกัดถูกระบุตรงไปตรงมา
**Exit (ระดับ live — เครื่องผู้ใช้)**: เพิ่มเติมด้วยการรัน BASE_URL=learnace.tech
จริงด้วยบัญชี QA ที่ได้รับอนุญาต + Database tests เมื่อได้รับ DATABASE_URL

## 7. ความเสี่ยงและข้อจำกัดที่ยังเปิดอยู่

1. DOM จริงของหน้าหลัง login ยังไม่เคยถูกแคป — locator เป็นแบบ multi-fallback
   และต้องปรับจูนด้วย `npx playwright codegen` (ดู README §Selector Calibration)
2. ลิมิตไฟล์ 5MB เป็น "สมมติฐานที่ติดป้าย verified:false" — ต้องยืนยันกับ backend จริง
3. เส้น POST ทั้งหมดยังไม่มีหลักฐานจากระบบจริง (WebFetch ทำได้เฉพาะ GET)
4. Firefox/WebKit ใน sandbox ติดตั้งไม่ครบ (ขาด OS libs ไม่มี root) — ผู้ใช้รัน
   `npm run install:browsers` บนเครื่องตัวเองเพื่อครบ 5 projects
