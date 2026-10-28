import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * LoginPage — หน้าเข้าสู่ระบบของ LearnAce
 *
 * หลักฐานจากการเข้าเว็บจริง:
 *   - หน้า /sign-in มีฟอร์ม: อีเมล, รหัสผ่าน + ปุ่ม "เข้าสู่ระบบ"
 *   - มีปุ่ม "ดำเนินการต่อด้วย Google" (Google OAuth)
 *   - มีลิงก์ "ลืมรหัสผ่าน?" และ "สมัครสมาชิก"
 *   - หน้าแรก "/" ฝังฟอร์มเข้าสู่ระบบไว้ด้วย (heading "เข้าสู่ระบบ")
 *   - /dashboard, /jobs เมื่อยังไม่ล็อกอิน จะแสดงเนื้อหาเข้าสู่ระบบ (protected)
 */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly googleButton: Locator;
  readonly errorMessage: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    super(page);

    // Locators แบบ resilient — ไม่ผูกกับ class/id ที่อาจเปลี่ยนบ่อย
    this.emailInput = page
      .locator(
        'input[type="email"], input[name="email"], ' +
        'input[placeholder*="อีเมล" i], input[placeholder*="email" i]'
      )
      .first();

    this.passwordInput = page.locator('input[type="password"]').first();

    this.loginButton = page
      .locator(
        'button[type="submit"], ' +
        'form button:has-text("เข้าสู่ระบบ"), ' +
        'button:has-text("Sign In"), button:has-text("Sign in"), button:has-text("Log in")'
      )
      .first();

    // ปุ่ม Google OAuth — ยืนยันข้อความจริงจากหน้าเว็บ: "ดำเนินการต่อด้วย Google"
    this.googleButton = page
      .getByRole('button', { name: /google/i })
      .or(page.getByRole('link', { name: /google/i }))
      .first();

    this.errorMessage = page
      .locator(
        '[role="alert"], ' +
        '[data-testid="login-error"], ' +
        '.error-message, ' +
        '.form-error, ' +
        '[class*="error" i][class*="message" i]'
      )
      .first();

    this.registerLink = page
      .getByRole('link', { name: /register|sign\s*up|สมัครสมาชิก/i })
      .first();

    this.forgotPasswordLink = page
      .getByRole('link', { name: /forgot\s*password|reset\s*password|ลืมรหัสผ่าน/i })
      .first();
  }

  /**
   * เปิดหน้าเข้าสู่ระบบ — หน้าจริงคือ /sign-in
   * หากฟอร์มไม่แสดง (เช่น ถูก redirect) จะลองหน้าแรกซึ่งฝังฟอร์มเข้าสู่ระบบไว้
   */
  async goto(): Promise<void> {
    await this.page.goto('/sign-in', { waitUntil: 'domcontentloaded' });

    const formFound = await this.emailInput
      .waitFor({ state: 'visible', timeout: 8_000 })
      .then(() => true)
      .catch(() => false);

    if (!formFound) {
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
      await this.emailInput.waitFor({ state: 'visible', timeout: 8_000 });
    }
  }

  /** กรอกอีเมล + รหัสผ่าน แล้วกดปุ่มเข้าสู่ระบบ */
  async signIn(email: string, password: string): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);

    await expect(this.loginButton).toBeEnabled();
    await this.loginButton.click();
  }

  /** ยืนยันว่าเข้าสู่ระบบสำเร็จ — ถูกพาไปหน้า /dashboard */
  async expectLoginSuccess(): Promise<void> {
    await expect(this.page).toHaveURL(/\/dashboard/i, { timeout: 30_000 });
    await this.expectMainContentVisible();
  }

  /** ยืนยันว่ายังอยู่หน้าเข้าสู่ระบบพร้อมข้อความ error */
  async expectLoginError(pattern?: RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (pattern) {
      await expect(this.errorMessage).toContainText(pattern);
    }
    await expect(this.page).not.toHaveURL(/\/dashboard/i);
  }

  /** ตรวจว่า validation กันการ submit ค่าว่าง (ฟอร์มยังไม่ถูกส่ง) */
  async expectEmptyFieldValidation(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/dashboard/i);
    const stillOnForm =
      (await this.emailInput.isVisible()) ||
      (await this.passwordInput.isVisible());
    expect(stillOnForm).toBe(true);
  }

  /** ไปยังหน้าสมัครสมาชิก (route จริงคือ /register — ยืนยันจากเว็บจริง) */
  async gotoRegister(): Promise<void> {
    await this.page.goto('/register', { waitUntil: 'domcontentloaded' });
  }

  /** ลิงก์ "ลืมรหัสผ่าน?" ต้องแสดงบนหน้าเข้าสู่ระบบ */
  async expectForgotPasswordLinkVisible(): Promise<void> {
    await expect(this.forgotPasswordLink).toBeVisible();
  }

  /** ปุ่ม Google OAuth ต้องแสดง */
  async expectGoogleButtonVisible(): Promise<void> {
    await expect(this.googleButton).toBeVisible();
  }

  /* ============================================================
   * Forgot Password — ฟังก์ชัน "ลืมรหัสผ่าน?" (โหมดสำรวจตามหลักฐาน)
   * หลักฐานที่ยืนยันแล้ว: หน้า /sign-in จริงมีลิงก์ "ลืมรหัสผ่าน?" (REAL 2026-10-28)
   * ยังไม่ยืนยัน: route ปลายทาง/โครงสร้างฟอร์ม — ทุกเมธอดจึงเดินแบบสำรวจ
   * และคืนสิ่งที่เกิดขึ้นจริงเสมอ ห้ามสมมติว่าหน้าไหนต้องมี (กฎเฟรมเวิร์ก)
   * ============================================================ */

  /**
   * คลิกลิงก์ "ลืมรหัสผ่าน?" แล้วรอสั้น ๆ — คืนสิ่งที่เกิดขึ้นจริง
   * clicked:false = ลิงก์หายไปจาก DOM หรือคลิกไม่สำเร็จ (ผู้เรียกต้องแนบ dump เป็นหลักฐาน)
   */
  async openForgotPassword(): Promise<{ clicked: boolean; urlAfter: string }> {
    const visible = await this.forgotPasswordLink.isVisible().catch(() => false);
    if (!visible) return { clicked: false, urlAfter: this.page.url() };
    try {
      await this.forgotPasswordLink.click({ timeout: 5_000 });
      await this.page
        .waitForLoadState('domcontentloaded', { timeout: 10_000 })
        .catch(() => {});
      await this.page.waitForTimeout(1_500); // เวลา SPA render ฟอร์ม/หน้าใหม่
      return { clicked: true, urlAfter: this.page.url() };
    } catch {
      return { clicked: false, urlAfter: this.page.url() };
    }
  }

  /**
   * ถ้าหน้าปัจจุบันมีฟอร์มอีเมล (หน้าลืมรหัสผ่านแบบเต็มหน้า หรือ modal) →
   * กรอกอีเมลแล้วกดปุ่มส่ง — คืน true เมื่อกดส่งสำเร็จ
   *
   * ใช้เป็น "โพรบพิสูจน์ว่าบัญชีมีอยู่จริง" ตามแนวทางเฟรมเวิร์ก:
   *   ระบบตอบแนว "ส่งลิงก์แล้ว/ตรวจอีเมล" = บัญชีมีอยู่
   *   ระบบตอบแนว "ไม่พบอีเมล/ไม่มีบัญชี" = บัญชียังไม่ถูกสร้าง
   */
  async submitForgotPasswordIfFormPresent(email: string): Promise<boolean> {
    if (!(await this.emailInput.isVisible().catch(() => false))) return false;

    await this.emailInput.fill(email);

    const sendButton = this.page
      .locator(
        'button[type="submit"], ' +
          'form button:has-text("ส่ง"), button:has-text("ส่งลิงก์"), ' +
          'button:has-text("ลืมรหัสผ่าน"), button:has-text("Reset"), button:has-text("Send")'
      )
      .first();
    if (!(await sendButton.isVisible().catch(() => false))) return false;

    try {
      await sendButton.click({ timeout: 5_000 });
      await this.page.waitForTimeout(2_000); // เวลา backend ตอบ (ข้อความสำเร็จ/ปฏิเสธ)
      return true;
    } catch {
      return false;
    }
  }
}