# Bug Report — LearnAce (learnace.tech)

> Phase 7 ของ MASTER PROMPT · ข้อบกพร่องทั้งหมดมาจาก "หลักฐานการสำรวจจริง"
> ไม่มีการแก้ไข Source Code ของเว็บไซต์ — รายงานพร้อมเสนอแนวทางแก้ไข

---

## BUG-001 — ไม่มีหน้า 404: URL ที่ไม่มีอยู่จริงแสดงหน้าเข้าสู่ระบบแทน

| หัวข้อ | รายละเอียด |
|---|---|
| **Environment** | https://learnace.tech (ตรวจผ่าน WebFetch proxy, 24 Oct 2026) |
| **Preconditions** | ไม่ล็อกอิน |
| **Steps to Reproduce** | 1) เปิด `https://learnace.tech/this-page-does-not-exist-xyz123` 2) สังเกตเนื้อหาที่แสดง |
| **Expected Result** | แสดงหน้า 404 / "ไม่พบหน้า" พร้อม navigation กลับ (best practice) |
| **Actual Result** | SPA แสดง **หน้าเข้าสู่ระบบเต็มรูปแบบ** ราวกับเป็นหน้าปกติ (HTTP 200-class) |
| **Severity** | Minor |
| **Priority** | P3 |
| **Evidence** | WebFetch probe ของ URL จำลอง → เนื้อหา heading "เข้าสู่ระบบ" + ฟอร์ม; regression test TC-ACC-006 ล็อกพฤติกรรมนี้ไว้ |
| **Related Test Case** | TC-ACC-006 |
| **Database Evidence** | ไม่มี (ไม่เกี่ยวข้องกับข้อมูล) |
| **Suspected Root Cause** *(ข้อสันนิษฐาน — ยังไม่ยืนยัน)* | SPA catch-all route จับทุก path ไม่รู้จักแล้ว render หน้า default แทนการแยก Not Found |
| **แนวทางแก้ไขที่เสนอ** | เพิ่ม Not Found route ที่ตรวจ path ไม่รู้จักแล้วแสดง UI 404 พร้อมลิงก์กลับหน้าแรก (ช่วย SEO + UX + การ debug ลิงก์เสีย) |

---

## BUG-002 — Route /sign-up ไม่ทำงานตามความคาดหวัง (route จริงคือ /register)

| หัวข้อ | รายละเอียด |
|---|---|
| **Environment** | https://learnace.tech (ตรวจจากการโพรบรอบก่อน — worklog 24 Oct 2026) |
| **Preconditions** | ไม่ล็อกอิน |
| **Steps to Reproduce** | 1) เปิด `https://learnace.tech/sign-up` 2) สังเกตเนื้อหา |
| **Expected Result** | แสดงฟอร์มสมัครสมาชิก (หรือ redirect ชัดเจนไป /register) |
| **Actual Result** | แสดง **หน้าเข้าสู่ระบบ** แบบเงียบ ๆ — ผู้ใช้ที่อยากสมัครไม่เห็นฟอร์มสมัคร |
| **Severity** | Minor |
| **Priority** | P3 |
| **Evidence** | ผลโพรบจากการสำรวจรอบก่อน (บันทึกใน worklog) — หมายเหตุ: ยังไม่ได้โพรบซ้ำในรอบนี้เพราะโควตาเครื่องมือ |
| **Related Test Case** | TC-AUTH-007 (ยืนยันลิงก์สมัครพาไป /register ซึ่งเป็น route จริง) |
| **Database Evidence** | ไม่มี |
| **Suspected Root Cause** *(ข้อสันนิษฐาน)* | ไม่มี alias จาก /sign-up → /register ใน routing |
| **แนวทางแก้ไขที่เสนอ** | เพิ่ม redirect `/sign-up` → `/register` (และพิจารณา `/signup`, `/join`) เพื่อรองรับลิงก์ภายนอกที่อาจชี้มา |

---

## BUG-003 — หน้า /admin เปิดเผยโครงสร้างระบบหลังบ้านต่อผู้ใช้ที่ยังไม่ยืนยันตัวตน

| หัวข้อ | รายละเอียด |
|---|---|
| **Environment** | https://learnace.tech/admin (ตรวจผ่าน WebFetch proxy โดยไม่มีบัญชี, 24 Oct 2026) |
| **Preconditions** | **ไม่ล็อกอิน / ไม่มีสิทธิ์ admin** |
| **Steps to Reproduce** | 1) เปิด `https://learnace.tech/admin` โดยไม่ล็อกอิน 2) อ่านเนื้อหาที่ render ก่อน login |
| **Expected Result** | แสดงเฉพาะฟอร์มเข้าสู่ระบบ ไม่เปิดเผยรายละเอียดภายในของระบบ |
| **Actual Result** | หน้าแสดง **ชื่อเมนูทั้งหมด** (System Overview / Services / Data / Users / Analysis / Audit log / Session) + **สถาปัตยกรรมภายใน** เช่น "Queue Analysis (BullMQ)", auto-refresh 15 วินาที, ชื่อคอลัมน์ตาราง Users/Analysis/Audit log (Operator, Action, Target, IP) และสูตรคำนวณ Success Rate |
| **Severity** | Low (ไม่พบว่าข้อมูลสถิติจริง/ข้อมูลผู้ใช้รั่ว — มีเพียงโครงสร้าง) |
| **Priority** | P3 (แต่แนะนำแก้เร็วเพราะเป็น Information Disclosure เชิงสถาปัตยกรรม) |
| **Evidence** | WebFetch ของ /admin โดยไม่มี credentials — ข้อความที่อ้างอิงมาจากการ render จริง |
| **Related Test Case** | TC-ADM-001 |
| **Database Evidence** | ไม่มี |
| **Suspected Root Cause** *(ข้อสันนิษฐาน)* | Admin shell (เมนู/layout) ถูก render client-side ก่อนเช็คสิทธิ์ แทนการ gate ทั้งหน้า |
| **แนวทางแก้ไขที่เสนอ** | เช็คสิทธิ์ก่อน render โครงสร้างใด ๆ — แสดงเฉพาะฟอร์ม login จนกว่าจะยืนยัน role ADMIN; ซ่อนชื่อเทคโนโลยีภายใน (BullMQ ฯลฯ) ออกจาก DOM ของหน้า gate |

---

## ข้อสังเกตเชิงป้องกัน (ไม่จัดเป็น Bug — เก็บไว้ตรวจเพิ่มเมื่อมีสิทธิ์)

| หัวข้อ | รายละเอียด |
|---|---|
| N-01 | ลิมิตขนาดไฟล์อัปโหลด 5MB ยังยืนยันไม่ได้จาก backend จริง — เฟรมเวิร์กติดป้าย `verified:false` ไว้แล้ว |
| N-02 | เส้น POST ทั้งหมด (login/register/upload/analyze) ยังไม่ถูกโพรบจริง — ต้องรันจากเครื่องที่เชื่อมต่อได้ |
| N-03 | Password policy แสดงบนหน้า /register ตรวจพบฝั่ง UI แล้ว — ยังต้องยืนยันว่า backend enforce เหมือนกัน (mock ฝั่งเฟรมเวิร์กตั้งสมมติฐานว่า enforce) |

---

## ข้อบกพร่องของ "เฟรมเวิร์กทดสอบ" ที่พบระหว่างรัน (แก้แล้ว — ไม่ใช่ bug ของเว็บเป้าหมาย)

| ID | รายละเอียด | สถานะ |
|---|---|---|
| TF-01 | `**/api/**` ในบล็อกคอมเมนต์ปิด comment ก่อนเวลา → TS compile error | ✅ แก้แล้ว |
| TF-02 | Mock login จับ `.invalid` เฉพาะท้าย email → negative test หลุด | ✅ แก้แล้ว |
| TF-03 | `.or()` strict mode violation ใน expectUploadSuccess | ✅ แก้แล้ว |
| TF-04 | Mock dashboard ทำ history หลังวิเคราะห์แบบ replace แทน prepend | ✅ แก้แล้ว |
| TF-05 | ใช้ `isVisible({timeout})` ซึ่งไม่รอจริง (TC-SES-003) | ✅ แก้แล้ว |
| TF-06 | `--reporter=line` ทับ reporters ใน config → รายงานไม่ถูกสร้างในรอบแรก | ✅ รันรอบ official โดยไม่ override |
