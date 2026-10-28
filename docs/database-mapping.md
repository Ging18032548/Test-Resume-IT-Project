# Database Mapping — learnace.tech

> Phase 4 ของ MASTER PROMPT — **เอกสารนี้ไม่มีการเดาชื่อตาราง คอลัมน์ หรือความสัมพันธ์ใด ๆ**
> ทุกหัวข้อระบุสถานะหลักฐานและสิ่งที่ต้องการเพิ่มเพื่อทำ mapping จริง

## 1. สรุปสถานะปัจจุบัน

| หัวข้อ | สถานะ |
|---|---|
| ชนิดฐานข้อมูล (MySQL / PostgreSQL / อื่น) | ❓ **ไม่ทราบ** — ไม่มี source code, env config หรือ schema ให้ตรวจ |
| ชื่อตาราง / คอลัมน์ / PK / FK / constraints | ❌ **ไม่มีข้อมูล** — ห้ามเดาตามข้อกำหนด |
| สิทธิ์เชื่อมต่อ (DATABASE_URL) | ❌ ยังไม่ได้รับ |
| Database Assertions | 🚫 **NOT RUN / BLOCKED** — ยังไม่ได้ Query จริง |
| กลไกเตรียมพร้อมในเฟรมเวิร์ก | ✅ สร้างเสร็จแล้ว (database-helper.ts + data-integrity.spec.ts) |

**ข้อความต่อผู้อนุมัติงาน**: ตามข้อกำหนด "ห้ามรายงานว่า Database ผ่านการทดสอบหากยังไม่ได้
Query จริง" — Database Validation ทั้งหมดจึงถูกรายงานเป็น **BLOCKED (รอสิทธิ์เข้าถึง)**
ดูผลจริงใน `docs/database-validation-report.md`

## 2. Mapping จาก Test Case → ตารางที่ "คาดว่า" เกี่ยวข้อง (สถานะ: รอหลักฐาน)

คอลัมน์ "Entity ที่เกี่ยวข้อง" ใช้คำทั่วไปตาม **ข้อมูลที่ UI แสดงจริง** (ไม่ใช่ชื่อตารางจริง)
เมื่อได้รับสิทธิ์แล้ว `TC-DB-003` จะค้นพบ schema จริงและตารางนี้จะถูกแทนที่ด้วยชื่อจริง

| TC ID | การกระทำบน UI/API | Entity ที่เกี่ยวข้อง (เชิงธุรกิจ) | Assertion ที่จะทำเมื่อได้สิทธิ์ | สถานะ |
|---|---|---|---|---|
| TC-REG-005 | สมัครสมาชิก | ผู้ใช้ใหม่ | มี record ใหม่, อีเมลตรง, รหัสผ่านเก็บแบบ hash (ไม่ plain text), unique constraint ทำงาน | BLOCKED |
| TC-AUTH-001 | เข้าสู่ระบบ | ผู้ใช้ + session/token | token ออกถูกต้อง; login audit เฉพาะ "ถ้าระบบเก็บจริง" (ไม่สมมติ) | BLOCKED |
| TC-AUTH-002 | รหัสผ่านผิด | — | ไม่มี record session ใหม่ | BLOCKED |
| TC-DSH-001/010 | อัปโหลด Resume | ไฟล์ Resume | record ไฟล์ใหม่ + metadata (ชื่อ, ขนาด, owner) | BLOCKED |
| TC-DSH-002/009 | วิเคราะห์ด้วย AI | ผลวิเคราะห์ | record ผลวิเคราะห์ (คะแนนรวม/section/status) ผูกกับ resume และผู้ใช้ | BLOCKED |
| TC-DSH-005/006 | ประวัติการวิเคราะห์ | ผลวิเคราะห์ย้อนหลัง | ข้อมูลบนหน้าตรงกับ query จริง | BLOCKED |
| TC-ADM-002/003 | สถิติ Admin | users / resumes / analyses (เชิงธุรกิจ) | ตัวเลขสถิติตรงกับ COUNT จริง; success rate ตรงสูตร Success ÷ (Success+Failure) | BLOCKED |
| TC-ADM-004 | ตาราง Users | ผู้ใช้ + สิทธิ์ | role ตรงตาม DB, การปลดล็อก/ตั้ง admin เปลี่ยนค่าจริง | BLOCKED |
| TC-ADM-006 | Audit log | เหตุการณ์ผู้ดูแล | การกระทำ admin ถูกบันทึกครบ (time/operator/action/target/IP) | BLOCKED |
| TC-DB-002..004 | โครงสร้างระบบ | ทั้งหมด | connectivity read-only + schema inventory + write-guard | BLOCKED |

## 3. กลไกที่เตรียมไว้ให้พร้อมใช้ทันทีเมื่อได้รับสิทธิ์

### 3.1 `helpers/database-helper.ts`
- ตรวจจับไดรเวอร์จาก `DATABASE_URL` scheme อัตโนมัติ (`postgres://` → pg, `mysql://` → mysql2)
- **บังคับ READ-ONLY ระดับ session**: PostgreSQL `SET default_transaction_read_only = on`,
  MySQL `SET SESSION TRANSACTION READ ONLY`
- **SQL guard**: ปฏิเสธคำสั่ง DROP/TRUNCATE/ALTER/CREATE/INSERT/UPDATE/DELETE/GRANT/REVOKE
  จากชั้นทดสอบเสมอ (ยืนยันโดย TC-DB-004)
- `discoverSchema()` — ค้นตาราง+คอลัมน์จริงจาก `information_schema` (มาตรฐานทั้งสองระบบ)
  แล้ว export เป็น `reports/db-inventory.json`

### 3.2 `tests/database/data-integrity.spec.ts`
- ไม่มี `DATABASE_URL` → รายงาน **BLOCKED** พร้อมเหตุผลมาตรฐานเดียวกันทุกที่
  (ตัวแปร `DB_BLOCKED_REASONS.noUrl`) — skip เหล่านี้คือ "NOT RUN ตามสาเหตุ" ไม่ใช่ผ่าน
- มี `DATABASE_URL` → TC-DB-002/003/004 ทำงานจริงทันที แล้วแนบ inventory เข้า HTML Report

## 4. ขั้นตอนเปิดใช้ Database Testing (เมื่อได้รับอนุญาต)

```powershell
# 1) แก้ไข .env — ใส่ URL แบบ READ-ONLY user ชี้ QA/Staging เท่านั้น
#    DATABASE_URL=postgresql://readonly_user:...@qa-host:5432/learnace_qa
# 2) รันเฉพาะชุด database
npm run test:db
# 3) ดู inventory ที่ค้นพบ
Get-Content reports/db-inventory.json
```

ข้อปฏิบัติตามข้อกำหนดความปลอดภัยของ MASTER PROMPT:
- ใช้ Staging/Test DB เท่านั้น — **ห้าม** Production DB
- ใช้ user สิทธิ์ SELECT (read-only) — helper ยังบังคับ read-only ซ้ำอีกชั้น
- ห้าม DROP/TRUNCATE และการล้างข้อมูลทั้งหมด — helper บล็อกที่ระดับ SQL guard
- ข้อมูลทดสอบที่สร้าง (ถ้าอนุญาตให้เขียนในอนาคต) ต้องติดป้าย Test Data และ cleanup เฉพาะชุดตัวเอง

## 5. หลักฐานอ้อมที่เก็บได้ ณ วันนี้ (ไม่ใช่ schema)

1. ระบบมีคิวงาน **BullMQ** (ข้อความจริงบน /admin) → backend ฝั่ง Node.js, การวิเคราะห์เป็น async job
2. สถานะการวิเคราะห์มีอย่างน้อย: In progress/Queued, Abnormally long pending, Success, Failed
   (ตัวเลือก filter จริงบน /admin) → entity ผลวิเคราะห์มี field สถานะ
3. ระบบมีแนวคิด Role (User/Admin) — จากตาราง Users บน /admin และ "Set Admin by email"
4. มี metric: success rate, เวลาเฉลี่ยต่อการวิเคราะห์ (avg time) — เก็บ timestamp เริ่ม/จบงาน
5. Auth เป็น token-based (401 TOKEN_REQUIRED) — ไม่ใช่ session cookie เท่านั้น

> หมายเหตุ: ทั้งหมดข้างต้นคือข้อสังเกตจาก UI จริง — ยังไม่ใช่หลักฐาน schema
> และจะไม่ถูกใช้เป็น "ชื่อตาราง" ใน assertion จนกว่าจะค้นพบจาก information_schema จริง
