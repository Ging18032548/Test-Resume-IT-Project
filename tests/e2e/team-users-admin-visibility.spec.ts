import { test, expect } from '../../fixtures/test-fixtures';
import { APP } from '../../config/config';
import { TEAM_USERS, hasTeamCredentials } from '../../fixtures/test-data';

/**
 * ============================================================
 * TEAM-ADM — ทดสอบด้วยบัญชีทีมงานจริง 3 คน (ข้อมูลที่ผู้ใช้ระบุ 2026-10-27)
 * ============================================================
 * เป้าหมาย: พิสูจน์เคสที่ผู้ใช้รายงานว่า "test sign in แล้วข้อมูล user
 * ไม่แสดงใน /admin" ว่าแก้แล้วได้ผลจริง ด้วยตัวตนของทีม 3 คน:
 *
 *   KANYARAT PATTHANAN   — สายงาน HR & Recruitment
 *   PHIRAPHAT CHAYANON   — สายงาน Finance & Financial Analyst
 *   VARIN METHAWEE       — สายงาน UI/UX Product Design
 *
 * ขั้นตอนต่อบัญชี (ทำผ่าน UI ของแอปจำลอง ให้ใกล้เครื่องจริงที่สุด):
 *   1. /register  → กรอกชื่อ-นามสกุล/อีเมล/รหัสผ่าน → สมัครสมาชิกสำเร็จ
 *   2. /sign-in   → กรอกอีเมล+รหัสผ่าน → เข้าสู่ระบบสำเร็จ (URL = /dashboard)
 *   3. /admin     → ตาราง Users ต้องมีทั้งชื่อที่แสดง "และ" อีเมลของคนนั้น
 *
 * ขอบเขตตามหลัก evidence-first:
 *  - ชุด MOCK: รันได้เฉพาะ MOCK_API=true และ BASE_URL = mock app server
 *    (เพราะ (1) การ register จริงบน production ต้องได้รับอนุญาตก่อนเสมอ
 *    ตามวาล์ว ALLOW_REGISTRATION_TEST และ (2) assertion ตาราง Users
 *    ผูกกับ DOM ของแอปจำลองที่เฟรมเวิร์กควบคุมได้ 100%)
 *  - ชุด REAL: รันเมื่อ MOCK_API=false + ตั้ง TEAM_*_PASSWORD ครบใน .env
 *    — เทสต์แค่ "sign in → ถึง /dashboard" เพราะการเปลี่ยนแปลงข้อมูลจริง
 *    (register) และสิทธิ์ดู /admin จริงขึ้นกับ role บนระบบจริงที่เรายืนยันไม่ได้
 */

test.describe('TEAM-ADM (MOCK) — ทีมงาน 3 คน: register → sign in → ข้อมูลแสดงใน /admin', () => {
  test.skip(
    !APP.mockApi || !APP.isMockAppServer,
    'ชุดนี้รันเฉพาะ MOCK_API=true + BASE_URL ชี้ mock app server (http://127.0.0.1:4310) — ' +
      'การ register บน production ต้องได้รับอนุญาตก่อนเสมอ และ DOM ตาราง Users บนเว็บจริงยัง UNVERIFIED'
  );

  for (const member of TEAM_USERS) {
    test(`[TEAM-ADM] ${member.displayName} (${member.department}) — สมัคร → เข้าสู่ระบบ → เห็นข้อมูลใน /admin`, async ({ page }) => {
      /* ---------- ขั้น 1: สมัครสมาชิกด้วยชื่อที่แสดงตามที่ผู้ใช้ระบุ ---------- */
      // หมายเหตุ: ฟอร์ม register มีช่องเดียว "ชื่อนามสกุล" — ใช้ displayName
      // ("Kanyarat Patthanan") ตามคำสั่งผู้ใช้; firstName/lastName ตัวพิมพ์ใหญ่
      // (KANYARAT / PATTHANAN) เป็นข้อมูลประกอบใน test-data.ts
      await page.goto('/register', { waitUntil: 'domcontentloaded' });

      await page.locator('#name').fill(member.displayName);
      await page.locator('#email').fill(member.email);
      await page.locator('#password').fill(member.password);
      await page.locator('#confirm').fill(member.password);

      // หลักฐานชั้น 1: register ต้องสำเร็จ (กล่อง success ปรากฏ)
      await page.locator('#register-btn').click();
      await expect(page.locator('#register-success')).toContainText('สมัครสมาชิกสำเร็จ');

      /* ---------- ขั้น 2: เข้าสู่ระบบด้วยอีเมล+รหัสผ่านของคนนั้น ---------- */
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
      await page.locator('#email').fill(member.email);
      await page.locator('#password').fill(member.password);

      // หลักฐานชั้น 2: sign in ต้องพาไปถึง /dashboard
      await page.locator('#login-btn').click();
      await expect(page).toHaveURL(/\/dashboard/i);

      /* ---------- ขั้น 3: /admin ต้องแสดงตัวตนของคนนั้นในตาราง Users ---------- */
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });

      const usersTable = page.getByTestId('users-table');

      // หลักฐานชั้น 3: ชื่อที่แสดงจริงต้องอยู่ในตาราง (ไม่ใช่ email prefix)
      await expect(usersTable).toContainText(member.displayName);
      await expect(usersTable).toContainText(member.email);

      // หลักฐานชั้น 4: จำนวนแถวต้องเป็น seed 3 คน + ตัวเอง 1 = 4 แถว
      // (พิสูจน์ว่า user ที่เพิ่งสมัคร/ล็อกอินถูกเพิ่มเข้าระบบจริง ไม่ใช่แค่ตอบ "สำเร็จ")
      await expect(usersTable.locator('tbody tr')).toHaveCount(4);
    });
  }
});

test.describe('TEAM-REAL — sign in จริงด้วยบัญชีทีม (เครื่องผู้ใช้, MOCK_API=false)', () => {
  test.skip(
    APP.mockApi || !hasTeamCredentials(),
    'BLOCKED: รันได้เฉพาะ MOCK_API=false และตั้ง TEAM_KANYARAT_PASSWORD / ' +
      'TEAM_PHIRAPHAT_PASSWORD / TEAM_VARIN_PASSWORD ครบใน .env — ' +
      'เงื่อนไขไม่ครบ = ห้ามยิง production (กฎเฟรมเวิร์ก: ไม่มีหลักฐานสิทธิ์ = ไม่รัน)'
  );

  for (const member of TEAM_USERS) {
    test(`[TEAM-REAL] ${member.displayName} — sign in บน learnace.tech ต้องถึง /dashboard`, async ({ page }) => {
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
      await emailInput.fill(member.email);
      await page.locator('input[type="password"]').first().fill(member.password);
      await page
        .locator('button[type="submit"], form button:has-text("เข้าสู่ระบบ")')
        .first()
        .click();

      // หมายเหตุ evidence-first: ถึง /dashboard = sign in จริงสำเร็จ
      // ถ้า FAIL ที่เครื่องผู้ใช้ = บัญชีนี้ยังไม่มีอยู่จริงบนระบบ หรือรหัสผ่านไม่ตรง
      // (สมัครจริงได้เมื่อ ALLOW_REGISTRATION_TEST=true + REGISTRATION_* ใน .env)
      await expect(page).toHaveURL(/\/dashboard/i, { timeout: 30_000 });
    });
  }
});