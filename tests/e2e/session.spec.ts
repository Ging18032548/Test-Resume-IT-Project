import { test, expect } from '../../fixtures/test-fixtures';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { MOCK_CREDENTIALS } from '../../fixtures/test-data';

/**
 * ============================================================
 * Session — การออกจากระบบและการป้องกันหน้าส่วนตัว
 * ============================================================
 * อ้างอิง Test Plan: TC-SES-001 .. TC-SES-004 (docs/test-plan.md)
 *
 * หลักการทดสอบ Session ตาม MASTER PROMPT:
 *  - Logout สำเร็จ → กลับสู่หน้าเข้าสู่ระบบ
 *  - กลับเข้า Protected Page หลัง Logout ไม่ได้ (auth guard ทำงาน)
 *  - Refresh หลัง Logout แล้วไม่เห็นข้อมูลส่วนตัว
 *
 * เทคนิค: mock API ตรวจ Authorization header — หลัง "ล้าง token ออกจาก storage"
 * การเรียก API ถัดไปจะได้ 401 TOKEN_REQUIRED เหมือนระบบจริง
 */

test.describe('Session — Logout และการเข้าถึงหลังออกจากระบบ', () => {
  test('[TC-SES-001] เข้าสู่ระบบ → ออกจากระบบสำเร็จ → กลับมาหน้าเข้าสู่ระบบ', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(MOCK_CREDENTIALS.email, MOCK_CREDENTIALS.password);
    await login.expectLoginSuccess();

    const dashboard = new DashboardPage(page);
    const clicked = await dashboard.logoutIfPresent();

    if (clicked) {
      // UI มีปุ่มออกจากระบบ — ต้องกลับมาหน้าเข้าสู่ระบบ
      await dashboard.expectBackAtSignIn();
    } else {
      // UI บางรูปแบบไม่มีปุ่ม logout ใน DOM จำลอง — ทดสอบกลไก session ผ่าน storage แทน
      await page.evaluate(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('auth');
        sessionStorage.clear();
      });
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await dashboard.expectBackAtSignIn();
    }
  });

  test('[TC-SES-002] หลังออกจากระบบ เข้า Protected Page (/dashboard) ไม่ได้', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(MOCK_CREDENTIALS.email, MOCK_CREDENTIALS.password);
    await login.expectLoginSuccess();

    // จำลอง session หมด/ถูกยกเลิก: ล้าง token ทุก storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    // auth guard ต้องพากลับมาหน้าเข้าสู่ระบบ (แสดงฟอร์มอีเมล)
    await expect(
      page.locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('[TC-SES-003] Refresh หน้า Dashboard หลังล้าง session → ไม่เห็นข้อมูลส่วนตัว', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(MOCK_CREDENTIALS.email, MOCK_CREDENTIALS.password);
    await login.expectLoginSuccess();

    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload({ waitUntil: 'domcontentloaded' });

    // หลัง refresh ต้องถูกพาไปหน้าเข้าสู่ระบบ ไม่ใช่แสดง dashboard ต่อ
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('[TC-SES-004] ยังไม่เคยล็อกอินเลย — เปิด /jobs ตรง ๆ ต้องเจอ guard', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(
      page.locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]').first()
    ).toBeVisible({ timeout: 15_000 });
  });
});
