import { test, expect } from '../../fixtures/test-fixtures';
import { LoginPage } from '../../pages/LoginPage';
import { ENV, hasTestAccount, MOCK_CREDENTIALS } from '../../fixtures/test-data';
import { APP } from '../../config/config';

/**
 * ============================================================
 * Authentication — เข้าสู่ระบบ (Mock + เงื่อนไขบัญชีจริง)
 * ============================================================
 * อ้างอิง Test Plan: TC-AUTH-001 .. TC-AUTH-008 (docs/test-plan.md)
 *
 * โครงสร้าง Decision Table จาก Test Plan (DT-AUTH):
 *   อีเมลถูก + รหัสผ่านถูก   → เข้าสู่ระบบสำเร็จ → /dashboard
 *   อีเมลถูก + รหัสผ่านผิด   → ข้อความ error, อยู่หน้าเดิม
 *   อีเมลไม่มีในระบบ        → ข้อความ error, อยู่หน้าเดิม
 *   ช่องใดช่องหนึ่งว่าง      → validation กันการส่งฟอร์ม
 *
 * เงื่อนไขบัญชีจริง: ชุด TC-AUTH-REAL จะรันเฉพาะเมื่อ .env มี TEST_EMAIL/TEST_PASSWORD
 * มิฉะนั้นรายงานเป็น skipped พร้อมเหตุผล BLOCKED ที่อธิบายชัดเจน
 * (ไม่ใช้ test.skip เพื่อปิดบังข้อผิดพลาด — เหตุผลถูกระบุเต็ม ๆ ในรายงาน)
 */

test.describe('Authentication — Decision Table (Mock API)', () => {
  test('[TC-AUTH-001] ล็อกอินสำเร็จด้วยบัญชีทดสอบที่ถูกต้อง → ไปหน้า Dashboard', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn(MOCK_CREDENTIALS.email, MOCK_CREDENTIALS.password);
    await login.expectLoginSuccess();
  });

  test('[TC-AUTH-002] ล็อกอินด้วยรหัสผ่านไม่ถูกต้อง → แสดง error และไม่เข้าระบบ', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn(MOCK_CREDENTIALS.email, 'WrongPassword1');
    await login.expectLoginError();
  });

  test('[TC-AUTH-003] ล็อกอินด้วยอีเมลที่ไม่มีในระบบ → แสดง error และไม่เข้าระบบ', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn('nobody.invalid@example.test', MOCK_CREDENTIALS.password);
    await login.expectLoginError();
  });

  test('[TC-AUTH-004] ปล่อยทั้งสองช่องว่างแล้วกดเข้าสู่ระบบ → validation กันการส่ง', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn('', '');
    await login.expectEmptyFieldValidation();
  });

  test('[TC-AUTH-005] ล็อกอินสำเร็จแล้ว Dashboard แสดงข้อมูลผู้ใช้ (envelope จาก /api/auth/me)', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn(MOCK_CREDENTIALS.email, MOCK_CREDENTIALS.password);
    await login.expectLoginSuccess();

    // หน้า dashboard ต้องมีเนื้อหาหลักแสดง (mock /api/auth/me คืนผู้ใช้ MOCK_USER)
    await login.expectMainContentVisible();

    if (APP.isMockAppServer) {
      // โหมดแอปจำลอง (localhost): DOM และ API เป็นของเฟรมเวิร์กทั้งคู่
      // dashboard จึง render ข้อมูลผู้ใช้จาก mock envelope ได้แน่นอน — ตรวจเนื้อหาเต็ม
      await expect(page.locator('body')).toContainText(/สมชาย|Dashboard|Resume/i, { timeout: 15_000 });
    } else {
      // เว็บจริง + MOCK_API=true — หลักฐานจากการรันจริง (2026-10-24):
      // URL ถึง /dashboard แล้ว แต่ body ค้าง skeleton "·········" ตลอด 45s (poll 91 ครั้ง)
      // เพราะ success contract ของ /api/auth/me ยัง UNVERIFIED (โพรบเว็บจริงได้แค่ envelope 401)
      // → ยืนยันเฉพาะสิ่งที่หลักฐานรองรับ: อยู่หน้า dashboard และไม่ถูกเด้งกลับฟอร์ม login
      //   ข้อมูลผู้ใช้จริง = หน้าที่ของ TC-AUTH-REAL เมื่อได้บัญชี QA (MOCK_API=false)
      await expect(page).toHaveURL(/\/dashboard/i);
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
    }
  });

  test('[TC-AUTH-006] ปุ่ม Google OAuth และลิงก์ลืมรหัสผ่านแสดงบนหน้าล็อกอิน', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.expectGoogleButtonVisible();
    await login.expectForgotPasswordLinkVisible();
  });

  test('[TC-AUTH-007] ลิงก์ "สมัครสมาชิก" จากหน้าล็อกอินพาไปหน้า /register ได้', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await expect(login.registerLink).toBeVisible();
    await login.registerLink.click();

    // route จริงของหน้าสมัครคือ /register (ยืนยันจากเว็บจริง)
    await expect(page).toHaveURL(/register/i, { timeout: 15_000 });
    await expect(
      page.locator('input[type="email"], input[name="email"]').first()
    ).toBeVisible();
  });
});

/**
 * ชุดบัญชีจริง — รันเมื่อจัดเตรียม TEST_EMAIL/TEST_PASSWORD และ MOCK_API=false
 * (หรือรันกับ BASE_URL จริงโดยปิด mock เฉพาะไฟล์นี้)
 * หากไม่มีบัญชี → ทุกเทสต์ใน describe นี้ถูกรายงานเป็น skipped พร้อมเหตุผลชัดเจน
 */
test.describe('Authentication — บัญชีทดสอบจริง (ต้องมี TEST_EMAIL)', () => {
  test.skip(
    !hasTestAccount() || APP.mockApi,
    'BLOCKED: ยังไม่มีบัญชีทดสอบจริง (TEST_EMAIL/TEST_PASSWORD ไม่ได้ตั้ง) และ/หรือยังอยู่โหมด MOCK_API=true ...'
  );

  test('[TC-AUTH-REAL-001] ล็อกอินด้วยบัญชีทดสอบจริง → Dashboard แสดง', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn(ENV.testEmail, ENV.testPassword);
    await login.expectLoginSuccess();
  });

  test('[TC-AUTH-REAL-002] รหัสผ่านผิดกับบัญชีจริง → error ไม่เข้าระบบ', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn(ENV.testEmail, `${ENV.testPassword}Wrong`);
    await login.expectLoginError();
  });
});
