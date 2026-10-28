import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * AdminDashboardPage — หน้าผู้ดูแลระบบ (/admin)
 *
 * โครงสร้างยืนยันจากการเข้า /admin จริง (WebFetch observation):
 *   - เมนู: System Overview / Services / Data / Users / Analysis / Audit log / Session
 *   - System Overview: สถิติและแนวโน้ม, Analysis by status (success/failure),
 *     อัตราสำเร็จ = Success ÷ (Success + Failure), เวลาเฉลี่ยต่อการวิเคราะห์,
 *     ตาราง trend (date, total, success, failure, success rate, avg time), ช่วง 7/30 วัน
 *   - Service Status: auto-refresh ทุก 15 วินาที, Queue Analysis (BullMQ)
 *   - Users: ค้นหา, ปลดล็อกการเข้าสู่ระบบ, จัดการสิทธิ์ Admin,
 *     ตาราง: User / Role / Registered When / Last Login / Resume-Analysis / Manage
 *   - Analysis: ตัวกรองสถานะ (All, In progress/Queued, Abnormally long pending,
 *     Success, Failed), Retry failed, Cancel pending,
 *     ตาราง: # / User-Resume / Type / Status / Score / Time / Created When / Manage
 *   - Audit log: Time / Operator / Action / Target / Details / IP
 *   - เมื่อยังไม่ล็อกอิน: หน้าแสดงส่วนเข้าสู่ระบบก่อน (auth gate)
 */
export class AdminDashboardPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  readonly overviewSection: Locator;
  readonly statCards: Locator;
  readonly successRate: Locator;
  readonly trendTable: Locator;
  readonly period7DaysButton: Locator;
  readonly period30DaysButton: Locator;

  readonly serviceStatusSection: Locator;
  readonly bullMqIndicator: Locator;

  readonly usersSection: Locator;
  readonly usersTable: Locator;
  readonly userSearchInput: Locator;

  readonly analysisSection: Locator;
  readonly analysisTable: Locator;
  readonly analysisStatusFilter: Locator;
  readonly retryFailedButton: Locator;

  readonly auditLogSection: Locator;
  readonly auditLogTable: Locator;

  constructor(page: Page) {
    super(page);

    /* ---------- Auth gate (แสดงเมื่อยังไม่ล็อกอิน) ---------- */
    this.emailInput = page
      .locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]')
      .first();
    this.passwordInput = page.locator('input[type="password"]').first();
    this.loginButton = page
      .locator('button[type="submit"], button:has-text("เข้าสู่ระบบ")')
      .first();

    /* ---------- System Overview ---------- */
    this.overviewSection = page
      .locator(
        '[data-testid="admin-overview"], ' +
        ':has-text("ภาพรวมระบบ"), :has-text("System Overview"), section:has(h2)'
      )
      .first();

    this.statCards = page
      .locator('[data-testid="admin-stat-card"], .stat-card, [class*="stat" i][class*="card" i]');

    this.successRate = page
      .locator('[data-testid="success-rate"], :has-text("Success Rate"), :has-text("อัตราความสำเร็จ")')
      .first();

    this.trendTable = page
      .locator('[data-testid="trend-table"], table')
      .first();

    this.period7DaysButton = page
      .getByRole('button', { name: /7\s*วัน|7\s*days/i })
      .first();
    this.period30DaysButton = page
      .getByRole('button', { name: /30\s*วัน|30\s*days/i })
      .first();

    /* ---------- Service Status (BullMQ) ---------- */
    this.serviceStatusSection = page
      .locator('[data-testid="service-status"], :has-text("Service Status"), :has-text("สถานะบริการ")')
      .first();

    this.bullMqIndicator = page
      .locator(':has-text("BullMQ"), [data-testid="queue-status"]')
      .first();

    /* ---------- Users ---------- */
    this.usersSection = page
      .locator('[data-testid="admin-users"], :has-text("ผู้ใช้"), section:has(:text("Users"))')
      .first();

    this.usersTable = page
      .locator('[data-testid="users-table"], table:has(th:has-text("Role")), table')
      .first();

    this.userSearchInput = page
      .locator('[data-testid="user-search"], input[type="search"], input[placeholder*="ค้นหา" i], input[placeholder*="search" i]')
      .first();

    /* ---------- Analysis ---------- */
    this.analysisSection = page
      .locator('[data-testid="admin-analysis"], section:has(:text("Analysis"))')
      .first();

    this.analysisTable = page
      .locator('[data-testid="analysis-table"], table:has(th:has-text("Status"))')
      .first();

    this.analysisStatusFilter = page
      .locator('[data-testid="analysis-filter"], select')
      .first();

    this.retryFailedButton = page
      .getByRole('button', { name: /retry|ลองใหม่|ดำเนินการซ้ำ/i })
      .first();

    /* ---------- Audit log ---------- */
    this.auditLogSection = page
      .locator('[data-testid="audit-log"], :has-text("Audit log"), :has-text("Audit Log")')
      .first();

    this.auditLogTable = page
      .locator('[data-testid="audit-table"], table:has(th:has-text("Action")), table')
      .first();
  }

  /** เปิดหน้า /admin */
  async goto(): Promise<void> {
    await this.page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await this.expectMainContentVisible();
  }

  /** เข้าสู่ระบบจากหน้า admin โดยตรง (auth gate) */
  async signInAsAdmin(email: string, password: string): Promise<void> {
    await expect(this.emailInput).toBeVisible();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  /** ยืนยันว่ายังไม่ล็อกอิน → เจอ auth gate */
  async expectAuthGateVisible(): Promise<void> {
    await expect(this.emailInput).toBeVisible({ timeout: 15_000 });
  }

  /** ยืนยันว่าเข้าสู่ระบบ admin สำเร็จ — เห็นส่วนสถิติ */
  async expectAdminContentLoaded(): Promise<void> {
    await expect(this.overviewSection).toBeVisible({ timeout: 30_000 });
  }

  /** ยืนยันการ์ดสถิติแสดงอย่างน้อย N ใบ */
  async expectStatCards(minCards: number): Promise<void> {
    await expect(this.statCards.first()).toBeVisible({ timeout: 30_000 });
    const count = await this.statCards.count();
    expect(count, `การ์ดสถิติต้องมีอย่างน้อย ${minCards} ใบ`).toBeGreaterThanOrEqual(minCards);
  }

  /** ยืนยันตารางผู้ใช้แสดงและมีอย่างน้อย N แถว */
  async expectUsersTable(minRows: number): Promise<void> {
    await expect(this.usersTable).toBeVisible({ timeout: 30_000 });
    const rowCount = await this.usersTable.locator('tbody tr').count();
    expect(rowCount, `ตารางผู้ใช้ต้องมีอย่างน้อย ${minRows} แถว`).toBeGreaterThanOrEqual(minRows);
  }

  /** ค้นหาผู้ใช้ด้วยคำค้น (ฟังก์ชัน Search ของแท็บ Users) */
  async searchUser(keyword: string): Promise<void> {
    await expect(this.userSearchInput).toBeVisible();
    await this.userSearchInput.fill(keyword);
    await this.userSearchInput.press('Enter');
  }

  /** ยืนยันตารางการวิเคราะห์ (Analysis) แสดง */
  async expectAnalysisTableVisible(): Promise<void> {
    await expect(this.analysisTable).toBeVisible({ timeout: 30_000 });
  }

  /** กรองสถานะการวิเคราะห์ (All / In progress / Success / Failed ฯลฯ) */
  async filterAnalysisByStatus(statusLabel: string): Promise<void> {
    await expect(this.analysisStatusFilter).toBeVisible();
    const asSelect = await this.analysisStatusFilter
      .selectOption({ label: statusLabel })
      .then(() => true)
      .catch(() => false);
    if (!asSelect) {
      // UI อาจเป็นปุ่ม filter แทน select
      await this.page.getByRole('button', { name: new RegExp(statusLabel, 'i') }).first().click();
    }
  }

  /** ยืนยัน Audit log แสดง */
  async expectAuditLogVisible(): Promise<void> {
    await expect(this.auditLogSection).toBeVisible({ timeout: 30_000 });
  }

  /** ยืนยันสัญญาณระบบคิวงาน (BullMQ) แสดงในส่วน Service Status */
  async expectBullMqIndicatorVisible(): Promise<void> {
    await expect(this.bullMqIndicator.first()).toBeVisible({ timeout: 30_000 });
  }

  /* ============================================================
   * Admin Tabs (เมนู) — โครงสร้างยืนยันจากการเข้า /admin จริง:
   *   System Overview / Services / Data / Users / Analysis / Audit log / Session
   * DOM จริงอาจเรนเดอร์เป็น link / button / tab / menuitem —
   * openAdminTab ลองทุก role แล้ว "คืนผลจริง" เสมอ (ห้ามสมมติว่าแท็บต้องมี)
   * ============================================================ */

  /** escape อักขระ regex — ใช้จับชื่อแท็บที่อาจมีจุด/วงเล็บ */
  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * เปิดแท็บ/เมนู admin ตามชื่อที่แสดง — คืน true เมื่อพบและคลิกสำเร็จ
   * คืน false = ไม่พบแท็บนี้บน DOM จริง (ผู้เรียกต้องแนบ dump เป็นหลักฐาน ห้ามเดา)
   */
  async openAdminTab(label: string): Promise<boolean> {
    const name = new RegExp(this.escapeRegExp(label), 'i');
    const tab = this.page
      .getByRole('tab', { name })
      .or(this.page.getByRole('link', { name }))
      .or(this.page.getByRole('button', { name }))
      .or(this.page.getByRole('menuitem', { name }))
      .first();
    if (!(await tab.isVisible().catch(() => false))) return false;
    try {
      await tab.click({ timeout: 5_000 });
      await this.page.waitForTimeout(1_500); // เวลา SPA สลับแท็บ + ยิง API ของแท็บนั้น
      return true;
    } catch {
      return false;
    }
  }

  /**
   * dump องค์ประกอบเชิงโต้ตอบทั้งหน้า (หัวข้อ/ปุ่ม/ลิงก์/ตาราง/ช่องกรอก) เป็นข้อความ
   * — แนบเป็นหลักฐานเมื่อแท็บ/ฟังก์ชันใดหาไม่เจอบน DOM จริง เพื่อพิสูจน์ว่าหน้ามีอะไรจริง ๆ
   */
  async interactiveElementsDump(): Promise<string> {
    return this.page
      .evaluate(() => {
        const pick = (el: Element, limit: number) => el.textContent?.trim().slice(0, limit) ?? '';
        const lines: string[] = [];

        document.querySelectorAll('h1, h2, h3, h4').forEach((el) => {
          const text = pick(el, 60);
          if (text) lines.push(`หัวข้อ: ${text}`);
        });
        document.querySelectorAll('button, [role="button"], [role="tab"]').forEach((el) => {
          const text = pick(el, 60);
          if (text) lines.push(`ปุ่ม: ${text}`);
        });
        document.querySelectorAll('a[href]').forEach((el) => {
          const text = pick(el, 60);
          if (text) lines.push(`ลิงก์: ${text}`);
        });
        document.querySelectorAll('table').forEach((table, index) => {
          const headers = Array.from(table.querySelectorAll('th'))
            .map((th) => pick(th, 30))
            .filter(Boolean);
          const rows = table.querySelectorAll('tbody tr').length;
          lines.push(
            `ตาราง #${index + 1}: ${rows} แถว${headers.length ? ` | หัวคอลัมน์: ${headers.join(', ')}` : ''}`
          );
        });
        document.querySelectorAll('input, select').forEach((el) => {
          const e = el as HTMLInputElement;
          const label = e.placeholder || e.name || e.type || e.tagName.toLowerCase();
          lines.push(`ช่องกรอก: ${label}${e.value ? ` (ค่า: ${e.value.slice(0, 24)})` : ''}`);
        });

        return lines.slice(0, 80).join('\n') || '(ไม่พบองค์ประกอบเชิงโต้ตอบ)';
      })
      .catch(() => '(dump องค์ประกอบไม่สำเร็จ)');
  }
}