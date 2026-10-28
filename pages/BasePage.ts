import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

/**
 * BasePage — ความสามารถพื้นฐานร่วมของทุกหน้า
 * รองรับทั้ง Desktop และ Mobile viewport (Responsive Support)
 */
export class BasePage {
  readonly page: Page;

  readonly hamburgerMenuButton: Locator;
  readonly userMenuButton: Locator;
  readonly logoutMenuItem: Locator;

  constructor(page: Page) {
    this.page = page;

    // ปุ่มแฮมเบอร์เกอร์บนมือถือ (ถ้ามี)
    this.hamburgerMenuButton = page
      .locator(
        '[data-testid="hamburger-menu"], ' +
        'button[aria-label*="menu" i], ' +
        'button[aria-label*="navigation" i], ' +
        '[class*="hamburger"]'
      )
      .first();

    // ปุ่ม/ไอคอนเมนูผู้ใช้ (avatar, account dropdown)
    this.userMenuButton = page
      .locator(
        '[data-testid="user-menu"], ' +
        'button[aria-label*="user" i], ' +
        'button[aria-label*="account" i], ' +
        '[class*="user-menu"], ' +
        'header img[alt*="avatar" i], ' +
        'header [class*="avatar"]'
      )
      .first();

    // รายการเมนูออกจากระบบ (หลังเปิดเมนูผู้ใช้)
    this.logoutMenuItem = page
      .getByRole('button', { name: /logout|sign\s*out|ออกจากระบบ/i })
      .or(page.getByRole('link', { name: /logout|sign\s*out|ออกจากระบบ/i }))
      .first();
  }

  /** ตรวจว่ากำลังรันบน viewport มือถือ (< 768px) หรือไม่ */
  async isMobileViewport(): Promise<boolean> {
    const viewport = this.page.viewportSize();
    if (!viewport) return false;
    return viewport.width < 768;
  }

  /** เปิดแฮมเบอร์เกอร์เมนูถ้ามี (มีผลเฉพาะบนจอแคบ) — คืนค่า true ถ้ากดจริง */
  async openMobileMenuIfPresent(): Promise<boolean> {
    if (
      (await this.hamburgerMenuButton.count()) > 0 &&
      (await this.hamburgerMenuButton.isVisible())
    ) {
      await this.hamburgerMenuButton.click();
      return true;
    }
    return false;
  }

  /** เปิดเมนูผู้ใช้ถ้ามี — คืนค่า true ถ้ากดจริง */
  async openUserMenuIfPresent(): Promise<boolean> {
    if (
      (await this.userMenuButton.count()) > 0 &&
      (await this.userMenuButton.isVisible())
    ) {
      await this.userMenuButton.click();
      return true;
    }
    return false;
  }

  /** ไปยัง path ที่กำหนดพร้อมรอ DOM โหลด */
  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
  }

  /** แนบ screenshot เข้า HTML Report ด้วยป้ายกำกับที่กำหนด */
  async attachScreenshot(testInfo: TestInfo, label: string): Promise<void> {
    const screenshot = await this.page.screenshot({ fullPage: true });
    await testInfo.attach(label, {
      body: screenshot,
      contentType: 'image/png',
    });
  }

  /** ยืนยันว่าหน้าเพจแสดงเนื้อหาหลักแล้ว (ไม่ค้างหน้าว่าง) */
  async expectMainContentVisible(): Promise<void> {
    await expect(
      this.page.locator('main, #__next, #root, body').first()
    ).toBeVisible();
  }

  /**
   * ออกจากระบบ — รองรับทั้งเมนู Desktop (dropdown) และ Mobile (hamburger)
   * คืนค่า true ถ้ากด logout สำเร็จ, false ถ้าไม่พบปุ่ม (เช่น ยังไม่ล็อกอิน)
   */
  async logoutIfPresent(): Promise<boolean> {
    await this.openMobileMenuIfPresent();
    await this.openUserMenuIfPresent();

    if ((await this.logoutMenuItem.count()) === 0) return false;

    try {
      await this.logoutMenuItem.click({ timeout: 5_000 });
      return true;
    } catch {
      return false;
    }
  }

  /** ยืนยันว่าถูกพากลับมาหน้าเข้าสู่ระบบ (หลัง logout หรือโดน guard) */
  async expectBackAtSignIn(): Promise<void> {
    await expect(
      this.page.locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]').first()
    ).toBeVisible({ timeout: 15_000 });
  }
}
