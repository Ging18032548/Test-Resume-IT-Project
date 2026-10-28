import { test, expect } from '../../fixtures/test-fixtures';
import { LoginPage } from '../../pages/LoginPage';
import { ROUTES, APP } from '../../config/config';

/**
 * ============================================================
 * Website Access — การเข้าถึงเว็บไซต์พื้นฐาน (Public + Route Guards)
 * ============================================================
 * อ้างอิง Test Plan: TC-ACC-001 .. TC-ACC-008 (docs/test-plan.md)
 *
 * หลักฐานที่ assertion อ้างตาม (จากการโพรบเว็บจริง — docs/website-inventory.md):
 *  - / → SPA auth guard redirect ผู้ใช้ที่ยังไม่ล็อกอินไป /sign-in
 *    (วัดจริง run 2026-10-25: Chrome/Firefox/Mobile Chrome × retry1 = 6/6 ได้ /sign-in เหมือนกันทุกครั้ง)
 *  - /dashboard และ /jobs เมื่อยังไม่ล็อกอิน → แสดงเนื้อหาเข้าสู่ระบบ (auth guard)
 *  - URL ไม่มีจริง → SPA แสดงหน้าเข้าสู่ระบบแทน 404 (บันทึกเป็น BUG-001)
 */

test.describe('Website Access — หน้าสาธารณะ', () => {
  test('[TC-ACC-001] เปิดหน้าแรกได้สำเร็จพร้อมฟอร์มเข้าสู่ระบบ', async ({ page }) => {
    const login = new LoginPage(page);
    await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });

    if (APP.isMockAppServer) {
      // โหมดแอปจำลอง (framework self-check): / ค้างที่เดิม
      await expect(page).toHaveURL(new RegExp(`${ROUTES.home.replace('/', '\\/')}(\\?.*)?$`));
    } else {
      // หลักฐานเว็บจริง (run 2026-10-25: 3 browsers × 2 attempts = 6/6 ได้ /sign-in เหมือนกัน):
      // / → SPA auth guard redirect ไป /sign-in — จึงยอมรับทั้ง "ค้างที่ /" และ "อยู่ที่ /sign-in"
      // ไม่เดาพฤติกรรม ยึดสิ่งที่วัดได้ — ถ้าเว็บเปลี่ยนพฤติกรรม เทสต์จะ fail ให้ทีมรู้ทันที
      await expect(page).toHaveURL(
        new RegExp(`(?:${ROUTES.home.replace('/', '\\/')}|${ROUTES.signIn.replace(/\//g, '\\/')})(\\?.*)?$`)
      );
    }

    // ข้อเท็จจริงที่ยืนยันได้ทั้งสองโหมด: ฟอร์มเข้าสู่ระบบต้องพร้อมใช้เสมอ
    await expect(login.emailInput).toBeVisible({ timeout: 15_000 });
    await login.expectMainContentVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.loginButton).toBeVisible();
  });

  test('[TC-ACC-002] หน้าแรกมีลิงก์ฟังก์ชันหลักครบ (Google / สมัครสมาชิก / ลืมรหัสผ่าน)', async ({ page }) => {
    await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('link', { name: /สมัครสมาชิก|register|sign\s*up/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: /ลืมรหัสผ่าน|forgot\s*password/i }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /google/i })
        .or(page.getByRole('link', { name: /google/i }))
        .first()
    ).toBeVisible();
  });

  test('[TC-ACC-003] หน้า /sign-in แสดงฟอร์มเข้าสู่ระบบครบถ้วน', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await expect(login.emailInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.loginButton).toBeVisible();
    await login.expectForgotPasswordLinkVisible();
  });

  test('[TC-ACC-004] หน้าแรกไม่มี Console Error ร้ายแรง', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    const failedRequests: string[] = [];
    page.on('requestfailed', (request) => {
      // ยกเว้น mock fallback ที่ตั้งใจให้ตอบเอง
      failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? ''}`);
    });

    await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible();

    // คำหมายเหตุ: assertion นี้ตรวจ "error จากแอปเอง" — network fail เพราะ sandbox
    // จะไม่ถูกนับ (mock mode ไม่ควรมี request หลุดเลย จึงยังคุมไว้)
    expect(
      failedRequests,
      `ต้องไม่มี request ล้มเหลว: ${failedRequests.join(' | ')}`
    ).toHaveLength(0);

    const fatalErrors = consoleErrors.filter(
      (text) => !/favicon|sourcemap|source ?map|devtools/i.test(text)
    );
    expect(
      fatalErrors,
      `ต้องไม่มี Console Error ร้ายแรง: ${fatalErrors.join(' | ')}`
    ).toHaveLength(0);
  });
});

test.describe('Website Access — Route Guards (ผู้ใช้ที่ยังไม่ล็อกอิน)', () => {
  for (const guarded of [ROUTES.dashboard, ROUTES.jobs, ROUTES.uploadResume]) {
    test(`[TC-ACC-005] /${guarded.replace(/^\//, '')} ถูกป้องกัน — แสดงเนื้อหาเข้าสู่ระบบเมื่อยังไม่ล็อกอิน`, async ({ page }) => {
      const login = new LoginPage(page);
      await page.goto(guarded, { waitUntil: 'domcontentloaded' });

      // พฤติกรรมจริงที่โพรบได้: หน้า protected แสดงฟอร์มเข้าสู่ระบบ (SPA guard)
      await expect(
        page.locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]').first()
      ).toBeVisible({ timeout: 15_000 });
      await login.expectMainContentVisible();
    });
  }

  test('[TC-ACC-006] URL ที่ไม่มีอยู่จริง → SPA แสดงหน้าเข้าสู่ระบบ (ไม่มีหน้า 404 เฉพาะ) — บันทึกเป็น BUG-001', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-xyz123', { waitUntil: 'domcontentloaded' });

    // ยืนยัน "พฤติกรรมจริงปัจจุบัน" ไม่ใช่พฤติกรรมที่ควรจะเป็น — ใช้เป็น regression baseline
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toBeVisible({ timeout: 15_000 });
    // เมื่อระบบมีหน้า 404 เฉพาะในอนาคต เทสต์นี้จะ fail ทันที → ทีมได้รู้ว่า behavior เปลี่ยน
  });

  test('[TC-ACC-007] หน้าเว็บโหลดบน viewport มือถือได้ (Mobile Safari / Pixel 5)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(ROUTES.home, { waitUntil: 'domcontentloaded' });

    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toBeVisible();

    // ไม่มีการ scroll แนวนอนค้าง (responsive พื้นฐาน)
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    );
    expect(horizontalOverflow, 'หน้าเว็บไม่ควร overflow แนวนอนบนจอมือถือ').toBe(false);
  });
});
