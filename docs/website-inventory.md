# Website Inventory — learnace.tech

> เอกสารสำรวจระบบตาม Phase 1 ของ MASTER PROMPT — ทุกรายการมีหลักฐานกำกับ
> วันที่สำรวจ: 24 ตุลาคม 2026 (เวลา UTC+7) · วิธีการ: WebFetch proxy probe (ดูข้อจำกัด §6)

## 1. ภาพรวมระบบ

LearnAce (https://learnace.tech) คือเว็บแอป **AI CV Analyzer** สำหรับวิเคราะห์ Resume
ด้วย AI แสดงจุดแข็ง/จุดที่ควรปรับปรุง และเทียบความเหมาะสมกับตำแหน่งงาน (Job Match)
เว็บไซต์ประกาศตัวเองว่าเป็นส่วนหนึ่งของรายวิชา "02739499 Information Technology Project"
(ตาม footer ทุกหน้า) — สำรวจพบว่า deploy ผ่าน Cloudflare tunnel

## 2. หน้าเว็บและเส้นทาง URL (ที่ตรวจสอบได้จริง)

| Route | สถานะเมื่อไม่ล็อกอิน | หลักฐาน | หมายเหตุ |
|---|---|---|---|
| `/` | เข้าถึงได้ — hero + ฟอร์มเข้าสู่ระบบฝังในหน้า | WebFetch ครั้งที่ 1 (24 Oct 2026) | มีลิงก์ Google OAuth, สมัครสมาชิก, ลืมรหัสผ่าน, นโยบายความเป็นส่วนตัว |
| `/sign-in` | เข้าถึงได้ — ฟอร์มเข้าสู่ระบบ (อีเมล/รหัสผ่าน) | WebFetch | heading "เข้าสู่ระบบ" ปุ่ม "ดำเนินการต่อด้วย Google" |
| `/register` | เข้าถึงได้ — ฟอร์มสมัครสมาชิก 4 ช่อง + password checklist 4 ข้อ | WebFetch | ดูรายละเอียด §3 |
| `/dashboard` | **ถูกป้องกัน** — แสดงเนื้อหาเข้าสู่ระบบแทน | WebFetch + worklog Task 3 | auth guard ทำงาน |
| `/jobs` | **ถูกป้องกัน** — แสดงเนื้อหาเข้าสู่ระบบแทน | WebFetch + worklog Task 3 | Job Description CRUD อยู่หลัง login |
| `/admin` | **auth gate** — แสดงส่วนเข้าสู่ระบบ + โครงสร้างเมนูของ admin (ดู §4) | WebFetch | รายละเอียดประเด็นความปลอดภัยใน bug-report (BUG-003) |
| `/resumes/upload` | ถูกป้องกัน (อ้างจาก repo อ้างอิง — โพรบตรง ๆ ไม่ได้ในรอบนี้) | worklog Task 2/5 | สถานะ UNVERIFIED เชิงลึก |
| `/sign-up` | แสดงเนื้อหาเข้าสู่ระบบ (route จริงของการสมัครคือ `/register`) | worklog Task 3 | บันทึกเป็น BUG-002 |
| URL ไม่มีจริง (ทดสอบ `/this-page-does-not-exist-xyz123`) | แสดงหน้าเข้าสู่ระบบ — **ไม่มีหน้า 404 เฉพาะ** | WebFetch รอบนี้ | บันทึกเป็น BUG-001 |
| `/forgot-password`, `/privacy` | มีลิงก์อ้างถึงจากหน้า login — โพรบตรง ๆ ยังไม่ได้ (โควตาเครื่องมือ) | ลิงก์บนหน้าจริง | สถานะ: ต้องตรวจซ้ำ |

## 3. ฟังก์ชันที่ตรวจพบ (จากหน้าจอจริง)

### 3.1 การเข้าสู่ระบบ (Sign In)
- ฟอร์ม: อีเมล + รหัสผ่าน + ปุ่ม "เข้าสู่ระบบ"
- **Google OAuth** — ปุ่ม "ดำเนินการต่อด้วย Google" (พบทั้งหน้าแรก, /sign-in, /register)
- ลิงก์ "ลืมรหัสผ่าน?" และ "สมัครสมาชิก" และ "นโยบายความเป็นส่วนตัว"
- หลังล็อกอินพาไป `/dashboard` (จากพฤติกรรม guard ของหน้า protected)

### 3.2 การสมัครสมาชิก (Register — หน้า /register)
ฟอร์ม 4 ช่อง: ชื่อนามสกุล / อีเเมล / รหัสผ่าน / ยืนยันรหัสผ่าน
**Password Policy แบบ real-time checklist 4 ข้อ** (ข้อความจริงจากหน้าเว็บ):
1. `อย่างน้อย 8 ตัวอักษร`
2. `ตัวพิมพ์ใหญ่ (A–Z)`
3. `ตัวพิมพ์เล็ก (a–z)`
4. `ตัวเลข (0–9)`
แต่ละข้อมีสถานะ `(ยังไม่ผ่าน)` ต่อท้ายจนกว่าจะผ่าน — มีข้อความยอมรับ
นโยบายความเป็นส่วนตัว/ความยินยอมประมวลผล Resume ก่อนสมัคร

### 3.3 ฟังก์ชันหลังล็อกอิน (จากหน้าแรก + repo อ้างอิง)
- อัปโหลด Resume (PDF) → เลือกตำแหน่งงาน → วิเคราะห์ด้วย AI
- ผลวิเคราะห์: Resume Score (หน้าแรกโชว์ตัวอย่าง 78), จุดแข็ง, จุดที่ควรปรับปรุง,
  ทักษะที่ตรงกับงาน (ตัวอย่างบนหน้าแรก: Node.js, React, SQL)
- Job Descriptions (CRUD ตำแหน่งงานเทียบ — จาก repo อ้างอิงที่ทดสอบ /jobs)
- ข้อจำกัด: หน้าเหล่านี้อยู่หลัง login — sandbox ไม่มีบัญชีทดสอบจึงตรวจ DOM จริงไม่ได้

### 3.4 หน้า Admin (/admin) — โครงสร้างที่เปิดเผยต่อผู้ใช้ทั่วไป
แม้ยังไม่ล็อกอิน หน้าจอแสดงโครงสร้างต่อไปนี้ (WebFetch จริง):
- เมนู: **System Overview / Services / Data / Users / Analysis / Audit log / Session**
- System Overview: สถิติและแนวโน้ม Resume Analysis, Analysis by status (success/failure),
  สูตร **Success Rate = Success ÷ (Success + Failure)**, เวลาเฉลี่ยต่อการวิเคราะห์,
  ตาราง trend (date, total, success, failure, success rate, avg time), ช่วงเวลา 7/30 วัน
- Service Status: **auto-refresh ทุก 15 วินาที**, **Queue Analysis (BullMQ)**
- Users: ค้นหา / ปลดล็อกการเข้าสู่ระบบ / จัดการสิทธิ์ Admin / Set Admin by email;
  ตาราง: User, Role, Registered When, Last Login, Resume/Analysis, Manage
- Analysis: กรองสถานะ (All, In progress/Queued, Abnormally long pending, Success, Failed),
  Retry failed, Cancel pending; ตาราง: #, User/Resume, Type, Status, Score, Time, Created When, Manage
- Audit log: Time, Operator, Action, Target, Details, IP

## 4. Tech Stack ที่มีหลักฐาน (Phase 2)

| องค์ประกอบ | หลักฐาน | ความมั่นใจ |
|---|---|---|
| Backend: Node.js + **BullMQ** (Redis queue) | ข้อความ "Queue Analysis (BullMQ)" บนหน้า /admin จริง | สูง (จาก UI จริง) |
| Frontend: SPA + Vite (dev port 5173) | `.env.example` ของ repo อ้างอิง (BASE_URL=localhost:5173) + SPA fallback behavior | ปานกลาง |
| Backend API แยกจาก frontend (port 5000) | `.env.example` ของ repo อ้างอิง (API_BASE_URL=localhost:5000) | ปานกลาง |
| Authentication: Bearer token + Google OAuth | envelope 401 TOKEN_REQUIRED + ปุ่ม Google จริง | สูง |
| ภาษา UI: ไทย | ทุกหน้าที่โพรบ | สูง |
| Deployment: Cloudflare tunnel | curl ตรง timeout + worklog ระบุตาม .env.example เดิม | สูง |
| **ฐานข้อมูล** | **ไม่มีหลักฐานใด** — ไม่มี source code / schema / env ให้ตรวจ | **ไม่ทราบ — ห้ามเดา** |

## 5. API Endpoints — ผลโพรบจริง (GET เท่านั้น)

Envelope มาตรฐานที่ยืนยันจากทุกเส้น: `{ success: boolean, message: string, code?: string }`

| Endpoint (GET) | ผลจริง | รหัส |
|---|---|---|
| `/api/jobs` | `{"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}` | 401-class |
| `/api/resumes` | TOKEN_REQUIRED เช่นเดียวกัน | 401-class |
| `/api/analyses` | `{"success":false,"message":"ไม่พบ API GET /api/analyses","code":"ENDPOINT_NOT_FOUND"}` | 404-class — **เส้นนี้ไม่มีอยู่จริง** |
| `/api/analyses/1` | TOKEN_REQUIRED (route รายการเดียวมีจริงแต่ถูกป้องกัน) | 401-class |
| `/api/auth/me` | TOKEN_REQUIRED | 401-class |
| `/api/admin/stats` | TOKEN_REQUIRED | 401-class |
| `/api/admin/users` | TOKEN_REQUIRED | 401-class |

เส้นที่ยังยืนยันไม่ได้ (ต้องใช้ POST/credentials): `/api/auth/login`, `/api/auth/register`,
`/api/resumes/upload`, trigger การวิเคราะห์, admin operations (retry/cancel/unlock)
— **ห้ามสรุปว่ามีหรือไม่มีอยู่จริงจนกว่าจะได้ทดสอบจากเครื่องที่เชื่อมต่อได้**

## 6. ข้อจำกัดของการสำรวจครั้งนี้ (รายงานตรงไปตรงมา)

1. **Sandbox นี้เชื่อมต่อ learnace.tech ตรงไม่ได้** — หลักฐาน: `curl https://learnace.tech`
   → `Connection timed out after 15002 milliseconds` (ทดสอบซ้ำในวันที่สำรวจ)
   การสำรวจทั้งหมดจึงใช้ WebFetch (proxy) — เห็นเนื้อหา rendered แต่ไม่เห็น raw HTML
   เต็ม (script tags/framework markers) และทำได้เฉพาะ GET
2. **ไม่มี Source Code ของเว็บไซต์** — repo ที่ผู้ใช้จัดเตรียม
   (AI-Resume-Test-Playwright2) เป็น "โปรเจกต์ทดสอบ" ไม่ใช่โค้ดแอป
   โครงสร้าง schema/API เชิงลึกจึงตรวจจากโค้ดไม่ได้
3. **ไม่มีบัญชีทดสอบ (TEST_EMAIL/TEST_PASSWORD)** — หน้าหลัง login
   (Dashboard/Upload/Analysis/Job CRUD) ตรวจเนื้อหาจริงไม่ได้
4. **ไม่มีสิทธิ์ฐานข้อมูล** — Database Assertions ทั้งหมดยัง NOT RUN (ดู database-mapping.md)
5. **โควตาเครื่องมือ WebFetch** จำกัด 15 call/ช่วง — เส้นบางเส้นยังโพรบไม่ครบ
   (`/api/analysis` เอกพจน์, `/forgot-password`, `/privacy`)

## 7. สิ่งที่ต้องการเพิ่มจากเจ้าของระบบ (ตาม MASTER PROMPT ข้อ "แจ้งรายการที่ต้องการ")

| รายการ | ใช้ทำอะไร |
|---|---|
| บัญชี QA (TEST_EMAIL/TEST_PASSWORD) ที่ได้รับอนุญาต | ทดสอบ flow หลัง login จริงบนเว็บเป้าหมาย |
| `DATABASE_URL` แบบ **read-only** ชี้ QA/Staging DB | เปิดใช้ tests/database + schema discovery จริง |
| Prisma/ORM schema หรือไฟล์ migrations (ถ้ามี) | เขียน database-mapping ที่อ้างตารางจริง ไม่เดา |
| รายชื่อ endpoint POST ทางการ (ถ้ามีเอกสาร) | ยืนยัน API contract เชิงลึก |
| อนุญาติให้สมัครบัญชีทดสอบจริง (ALLOW_REGISTRATION_TEST) | ทดสอบ registration E2E แบบไม่ทิ้งขยะในระบบ |
