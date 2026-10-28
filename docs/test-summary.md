# Automated Test Summary Report — LearnAce Automation

> Phase 6 ของ MASTER PROMPT · ผลการรันจริง 100% ตามไฟล์ `reports/test-results.json`
> (ไม่มีการปลอมผลใด ๆ — เทสต์ที่ไม่ได้รันถูกรายงานสถานะและเหตุผลเต็ม ๆ)

## 1. สรุปตัวเลขการรัน (Official Run)

- **วันที่/เวลารัน**: 24 ตุลาคม 2026 (สภาพแวดล้อม sandbox)
- **คำสั่ง**: `npx playwright test --project="Desktop Chrome" --project="Desktop Firefox" --project="Mobile Chrome"`
- **BASE_URL**: `http://127.0.0.1:4310` (mock-app-server — ดูข้อจำกัด §5)

| ตัวชี้วัด | ค่า |
|---|---|
| **Total Tests (รวมทุก project)** | **180** (60 เคสเฉพาะตัว × 3 projects) |
| **Passed** | **165** |
| **Failed** | **0** |
| **Flaky** | **0** |
| **Skipped (BLOCKED พร้อมเหตุผล)** | **15** (9 Database + 6 Real-account) |
| **Not Run** | 0 (ทุกเทสต์ถูกเรียก — ที่ไม่ได้ execute ถูกจัดสถานะ skipped/BLOCKED แล้ว) |

**สูตร Pass Rate (ชัดเจนตามข้อกำหนด — ไม่นับเทสต์ที่ไม่ได้รันเป็น PASS):**

```
Pass Rate = Passed ÷ (Passed + Failed) = 165 ÷ (165 + 0) = 100.0%
Execution Rate = (Passed + Failed) ÷ Total = 165 ÷ 180 = 91.7%
Blocked Rate = Skipped ÷ Total = 15 ÷ 180 = 8.3%  (ทั้งหมดมีเหตุผล BLOCKED กำกับ)
```

## 2. ผลแยกตามไฟล์ทดสอบ (รวม 3 projects)

| ไฟล์ | โมดูล | Total | Passed | Skipped | Failed |
|---|---|---|---|---|---|
| tests/e2e/website-access.spec.ts | Access (ACC) | 27 | 27 | 0 | 0 |
| tests/e2e/registration.spec.ts | Registration (REG) | 24 | 24 | 0 | 0 |
| tests/e2e/authentication.spec.ts | Authentication (AUTH) | 27 | 21 | 6 | 0 |
| tests/e2e/session.spec.ts | Session (SES) | 12 | 12 | 0 | 0 |
| tests/e2e/dashboard.spec.ts | Dashboard (DSH) | 30 | 30 | 0 | 0 |
| tests/e2e/admin-analytics.spec.ts | Admin (ADM) | 21 | 21 | 0 | 0 |
| tests/api/api-validation.spec.ts | API | 27 | 27 | 0 | 0 |
| tests/database/data-integrity.spec.ts | Database (DB) | 12 | 3 | 9 | 0 |
| **รวม** | | **180** | **165** | **15** | **0** |

## 3. รายการเทสต์ที่ BLOCKED (สถานะจริง — พร้อมเหตุผลที่แสดงใน HTML Report)

| เคส | จำนวน | เหตุผล (ข้อความจริงจาก skip) | สิ่งที่ต้องการเพื่อเปิดรัน |
|---|---|---|---|
| TC-DB-002 / TC-DB-003 / TC-DB-004 | 9 (3 เคส × 3 projects) | `BLOCKED: ยังไม่ได้รับ DATABASE_URL / สิทธิ์เข้าถึงฐานข้อมูล — Database Assertions จึงยังไม่ได้ Query จริง (ตามข้อกำหนดห้ามเดา schema)` | DATABASE_URL แบบ read-only ชี้ QA/Staging DB |
| TC-AUTH-REAL-001 / TC-AUTH-REAL-002 | 6 (2 เคส × 3 projects) | `BLOCKED: ยังไม่มีบัญชีทดสอบจริง (TEST_EMAIL/TEST_PASSWORD ไม่ได้ตั้ง) และ/หรือยังอยู่โหมด MOCK_API=true — ต้องจัดเตรียมบัญชี QA ที่ได้รับอนุญาตก่อนจึงจะยืนยันกับระบบจริงได้` | บัญชี QA + รันบนเครื่องที่เชื่อมต่อเว็บเป้าหมายได้ |
| TC-API-008 (โหมด live เท่านั้น) | 0 (รันผ่านในโหมด mock) | skip เฉพาะเมื่อ `MOCK_API=false` แต่ไม่มีบัญชีจริง | เหมือนกลุ่ม REAL ข้างบน |

## 4. Database Validation — สถานะเป็นทางการ

**BLOCKED / NOT RUN** — ยังไม่ได้ Query ฐานข้อมูลจริงแม้แต่ครั้งเดียว
(รายละเอียดและแผนเปิดใช้: `docs/database-validation-report.md` + `docs/database-mapping.md`)
TC-DB-001 ที่รันผ่าน (3 project) คือเทสต์ "ยืนยันว่าระบบรายงาน BLOCKED อย่างถูกต้อง"
— ไม่ใช่การผ่านการทดสอบฐานข้อมูล

## 5. ข้อจำกัดของผลรันชุดนี้ (รายงานตรงไปตรงมา)

1. **รันกับ mock-app-server ในเครื่อง sandbox** — เพราะ sandbox เชื่อมต่อ
   learnace.tech ตรงไม่ได้ (curl timeout — หลักฐานใน website-inventory §6)
   ผลชุดนี้จึง **ยืนยันความถูกต้องของเฟรมเวิร์กและ assertion** ไม่ใช่ผลบนระบบจริง
2. **API เทสต์กับระบบจริง**: พฤติกรรมที่ assertion คาดหวังถูกโพรบยืนยันจาก
   learnace.tech จริงแล้วผ่าน WebFetch (TOKEN_REQUIRED/ENDPOINT_NOT_FOUND)
   — ผู้ใช้รันซ้ำกับเว็บจริงได้ทันทีด้วยคำสั่งใน README (BASE_URL=learnace.tech)
3. **Desktop Safari / Mobile Safari** (WebKit) รันใน sandbox ไม่ได้
   (ขาด OS libraries — ไม่มีสิทธิ์ root ติดตั้ง) — ผู้ใช้รัน `npm run install:browsers`
   แล้วใช้ `npm test` เพื่อครบ 5 projects
4. ไม่มีการแก้ไข "ระบบเป้าหมาย" ใด ๆ — การ fix ทั้งหมดของรอบนี้เป็นฝั่ง
   Test Framework/Mock เท่านั้น (บันทึกใน Execution Log §6)

## 6. Execution Log — ปัญหาที่พบระหว่างรันและการแก้ไข (ฝั่งเฟรมเวิร์กเท่านั้น)

| รอบ | ปัญหา | สาเหตุ | การแก้ไข (ฝั่งเฟรมเวิร์ก) | ผลหลังแก้ |
|---|---|---|---|---|
| 1 | TS2304 compile error | `**/api/**` ในบล็อกคอมเมนต์ปิด comment ก่อนเวลา | ปรับข้อความคอมเมนต์ | tsc ผ่าน |
| 1 | TC-AUTH-003 fail | กติกา mock จับ `.invalid` เฉพาะท้าย email | ขยายเป็น "มี .invalid ที่ใดก็ได้" ทั้ง fixture และ mock server | ผ่าน |
| 1 | TC-DSH-001/009 fail | `.or()` strict violation + history ถูก replace ด้วย 1 แถว | ตัด `.or()`; mock dashboard prepend ประวัติแทน replace | ผ่าน |
| 1 | TC-SES-003 fail | `isVisible({timeout})` ไม่รอจริง (legacy semantics) | เปลี่ยนเป็น `expect().toBeVisible()` ที่ poll | ผ่าน |
| 2 | รายงานไม่ถูกสร้าง | `--reporter=line` ทับ reporters ของ config | รันรอบ official โดยไม่ override reporter | HTML + JSON สร้างครบ |

## 7. สิ่งที่แนบใน HTML Report (playwright-report/index.html)

- สถานะรายเคส + เวลาที่ใช้ + retries
- Screenshot อัตโนมัติเฉพาะกรณี fail (`screenshot: 'only-on-failure'`)
- Video เก็บเฉพาะกรณี fail (`video: 'retain-on-failure'`)
- Trace เก็บเฉพาะกรณี fail (`trace: 'retain-on-failure'`)
- Attachment เพิ่มเติม: `database-blocked-reason.txt` จาก TC-DB-001

เปิดดู: `npm run report` (หรือ `npx playwright show-report playwright-report`)
