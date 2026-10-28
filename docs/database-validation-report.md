# Database Validation Report — LearnAce

> เอกสารตาม Phase 6 ข้อ 4 ของ MASTER PROMPT · สถานะทางการ: **BLOCKED (NOT RUN)**

## 1. ข้อความสถานะทางการ

**Database Assertions ยังไม่ได้ดำเนินการจริง (NOT RUN — สาเหตุ: BLOCKED)**

เหตุผล: ยังไม่ได้รับ `DATABASE_URL` / สิทธิ์เข้าถึงฐานข้อมูลของ learnace.tech
และไม่มี Source Code หรือ Schema ให้ตรวจสอบ — ตามข้อกำหนดของ MASTER PROMPT
("ห้ามเดาชื่อตาราง ชื่อคอลัมน์ หรือความสัมพันธ์ของข้อมูล" และ
"ห้ามรายงานว่า Database ผ่านการทดสอบหากยังไม่ได้ Query จริง")

## 2. หลักฐานว่า "ยังไม่ได้ Query จริง" คือความจริง ไม่ใช่ข้ออ้าง

1. `tests/database/data-integrity.spec.ts` รันจริงใน official run —
   TC-DB-001 (3 projects) **ผ่าน** โดยยืนยันว่าระบบรายงานสถานะ BLOCKED ถูกต้อง,
   TC-DB-002/003/004 (9 รายการ) ถูก skip พร้อมข้อความเหตุผลมาตรฐาน
   `DB_BLOCKED_REASONS.noUrl` — ตรวจได้จาก HTML Report
2. `helpers/database-helper.ts` **ยังไม่เคยถูกเรียก connect() สำเร็จ** เพราะ
   `readinessIssue()` คืนเหตุผล BLOCKED ทันทีเมื่อไม่มี DATABASE_URL
3. ไม่มีไฟล์ `reports/db-inventory.json` (สร้างเฉพาะเมื่อ discovery ทำงานจริง)

## 3. สิ่งที่ "พร้อมทำงานทันที" เมื่อได้รับสิทธิ์

| เคส | สิ่งที่จะทำ | เงื่อนไขความปลอดภัย |
|---|---|---|
| TC-DB-002 | เชื่อมต่อ + `SELECT 1` | Read-only session level + SQL guard |
| TC-DB-003 | `discoverSchema()` จาก information_schema → `reports/db-inventory.json` | SELECT เท่านั้น |
| TC-DB-004 | ยืนยันว่า helper ปฏิเสธคำสั่งเขียน | ป้องกันความเสียหาย |
| (ต่อยอด) | Mapping จริงตาม docs/database-mapping.md §2 | หลังมี inventory จริง |

## 4. รายการที่ต้องการจากเจ้าของระบบ (แจ้งล่วงหน้าตามข้อกำหนด)

1. **DATABASE_URL (read-only)** ชี้ QA/Staging database — รูปแบบ
   `postgresql://...` หรือ `mysql://...` (เฟรมเวิร์กตรวจจับอัตโนมัติ)
2. **ชนิดฐานข้อมูลจริง** (ถ้าเป็นระบบอื่นนอกจาก PostgreSQL/MySQL ต้องแจ้งล่วงหน้า
   เพราะ helper รองรับเฉพาะสองชนิดนี้ — ไม่เดา)
3. Prisma/ORM schema หรือ migrations (ถ้ามี) — ใช้เร่ง mapping แต่ยังต้องยืนยันกับ DB จริง
4. ข้อตกลงว่าจะไม่ใช้ Production DB สำหรับการทดสอบใด ๆ

## 5. ความเสี่ยงหากยังไม่ได้ทดสอบชั้น Database

- Data Persistence จริง (สมัคร/อัปโหลด/วิเคราะห์/ลบ) ยังไม่ถูกยืนยันปลายทาง
- Unique constraint / FK / transactional behavior ยังไม่ถูกตรวจ
- สถิติหน้า Admin ยังไม่ถูกเทียบกับ COUNT จริงของฐานข้อมูล
- ข้อสรุปชุดนี้จึงครอบคลุมเฉพาะ UI (mocked) + API contract ระดับ HTTP เท่านั้น
