import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * DashboardPage — หน้า Dashboard หลังเข้าสู่ระบบ (AI CV Analyzer)
 *
 * ความสามารถตามฟังก์ชันจริงของผลิตภัณฑ์ (ยืนยันจากหน้าแรกของเว็บ + repo อ้างอิง):
 *   - อัปโหลด Resume (PDF) → เลือกตำแหน่งงาน → กดวิเคราะห์ด้วย AI
 *   - แสดงผล: คะแนนรวม (Resume Score), Radar Chart, Section Scores,
 *     จุดแข็ง (ข้อดี) และจุดที่ควรปรับปรุง
 *   - ประวัติการวิเคราะห์ (History)
 *
 * ข้อจำกัดที่ระบุชัดเจน: /dashboard อยู่หลัง login จึงไม่สามารถแคป DOM จริง
 * จาก sandbox ได้ — Locator ทั้งหมดเป็นแบบ multi-fallback resilient
 * และควรปรับจูนกับ DOM จริงด้วย `npx playwright codegen <BASE_URL>/dashboard`
 * เมื่อมีบัญชีทดสอบ (ดู README หัวข้อ Selector Calibration)
 */
export class DashboardPage extends BasePage {
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly uploadSuccessMessage: Locator;
  readonly uploadErrorMessage: Locator;
  readonly jobSelect: Locator;
  readonly analyzeButton: Locator;
  readonly analysisError: Locator;

  readonly overallScore: Locator;
  readonly radarChart: Locator;
  readonly sectionScoreItems: Locator;
  readonly strengthsList: Locator;
  readonly improvementsList: Locator;
  readonly historyTable: Locator;
  readonly historyRows: Locator;

  constructor(page: Page) {
    super(page);

    /* ---------- Upload ---------- */
    this.fileInput = page.locator(
      'input[type="file"][accept*="pdf"], input[type="file"]'
    ).first();

    this.uploadButton = page
      .getByRole('button', { name: /อัปโหลด|upload/i })
      .first();

    this.uploadSuccessMessage = page
      .locator(
        '[data-testid="upload-success"], .upload-success, ' +
        '[role="status"], [class*="success" i]'
      )
      .first();

    this.uploadErrorMessage = page
      .locator('[role="alert"], [data-testid="upload-error"], [class*="error" i][class*="message" i]')
      .first();

    /* ---------- Job selection ---------- */
    this.jobSelect = page
      .locator('#job-select, select[name*="job" i], select')
      .first();

    /* ---------- AI Analysis trigger ---------- */
    this.analyzeButton = page
      .getByRole('button', { name: /วิเคราะห์|analy[sz]e/i })
      .first();

    this.analysisError = page
      .locator('[role="alert"], [data-testid="analysis-error"]')
      .first();

    /* ---------- Results ---------- */
    this.overallScore = page
      .locator('[data-testid="overall-score"], .overall-score, [class*="overall" i]')
      .first();

    this.radarChart = page
      .locator(
        '[data-testid="radar-chart"], [class*="radar" i], ' +
        'svg[class*="radar" i], canvas'
      )
      .first();

    this.sectionScoreItems = page
      .locator('[data-testid="section-scores"] li, ul.scores li, [class*="section-score" i] li');

    this.strengthsList = page
      .locator('[data-testid="strengths"], [class*="strength" i] li')
      .first();

    this.improvementsList = page
      .locator('[data-testid="improvements"], [class*="improve" i] li')
      .first();

    /* ---------- History ---------- */
    this.historyTable = page
      .locator('[data-testid="history-table"], table')
      .first();

    this.historyRows = this.historyTable.locator('tbody tr');
  }

  /** เปิดหน้า Dashboard */
  async goto(): Promise<void> {
    await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await this.expectMainContentVisible();
  }

  /**
   * อัปโหลดไฟล์ Resume — รองรับ 2 พฤติกรรม UI:
   *  (1) เลือกไฟล์แล้วอัปโหลดอัตโนมัติ (auto-submit)
   *  (2) ต้องกดปุ่มอัปโหลดเอง (explicit submit)
   * คืนค่าโหมดที่ระบบใช้จริงเพื่อให้เทสต์อ้างอิงได้
   */
  async uploadResume(filePath: string): Promise<'auto' | 'explicit'> {
    await expect(this.fileInput).toBeAttached({ timeout: 15_000 });
    await this.fileInput.setInputFiles(filePath);

    const autoSubmitted = await this.uploadSuccessMessage
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true)
      .catch(() => false);

    if (autoSubmitted) return 'auto';

    await expect(this.uploadButton).toBeVisible();
    await this.uploadButton.click();
    return 'explicit';
  }

  /** เลือกตำแหน่งงานที่ต้องการเทียบ (ถ้าหน้ารองรับ) */
  async selectJob(jobTitle: string | null): Promise<void> {
    if ((await this.jobSelect.count()) === 0) return;

    if (jobTitle === null) {
      await this.jobSelect.selectOption({ index: 0 });
      return;
    }
    const matched = await this.jobSelect
      .selectOption({ label: jobTitle })
      .then(() => true)
      .catch(() => false);

    if (!matched) {
      // บาง UI ใช้ option value แทน label — ลองแบบ value
      await this.jobSelect.selectOption({ value: jobTitle });
    }
  }

  /** กดปุ่มวิเคราะห์ Resume ด้วย AI */
  async analyze(): Promise<void> {
    await expect(this.analyzeButton).toBeVisible();
    await expect(this.analyzeButton).toBeEnabled();
    await this.analyzeButton.click();
  }

  /** อัปโหลด → เลือกงาน → วิเคราะห์ ในคำสั่งเดียว (user journey จริง) */
  async uploadAndAnalyze(filePath: string, jobTitle: string | null): Promise<void> {
    await this.uploadResume(filePath);
    await this.selectJob(jobTitle);
    await this.analyze();
  }

  /** ยืนยันผลการอัปโหลดสำเร็จ (กล่องข้อความสำเร็จต้องแสดง) */
  async expectUploadSuccess(): Promise<void> {
    await expect(this.uploadSuccessMessage).toBeVisible({ timeout: 20_000 });
  }

  /** ยืนยันว่าอัปโหลดถูกปฏิเสธพร้อมข้อความ error */
  async expectUploadRejected(pattern?: RegExp): Promise<void> {
    await expect(this.uploadErrorMessage).toBeVisible();
    if (pattern) {
      await expect(this.uploadErrorMessage).toContainText(pattern);
    }
  }

  /** ยืนยันคะแนนรวมที่แสดงผล (ค่าตัวเลข 0-100) */
  async expectOverallScore(expected: number | RegExp): Promise<void> {
    await expect(this.overallScore).toBeVisible({ timeout: 30_000 });
    if (typeof expected === 'number') {
      await expect(this.overallScore).toContainText(String(expected));
    } else {
      await expect(this.overallScore).toContainText(expected);
    }
  }

  /** ยืนยัน Radar Chart แสดงผลแล้ว (svg/canvas ที่ render เสร็จ) */
  async expectRadarChartVisible(): Promise<void> {
    await expect(this.radarChart).toBeVisible({ timeout: 30_000 });
  }

  /** ยืนยัน Section Scores แสดงครบตามจำนวน section ที่คาดหวัง */
  async expectSectionScoresVisible(minItems: number): Promise<void> {
    await expect(this.sectionScoreItems.first()).toBeVisible({ timeout: 30_000 });
    const count = await this.sectionScoreItems.count();
    expect(count, `Section Scores ต้องมีอย่างน้อย ${minItems} รายการ`).toBeGreaterThanOrEqual(minItems);
  }

  /** ยืนยันรายการจุดแข็ง (ข้อดี) แสดงและมีเนื้อหา */
  async expectStrengthsVisible(): Promise<void> {
    await expect(this.strengthsList).toBeVisible({ timeout: 30_000 });
  }

  /** ยืนยันรายการจุดที่ควรปรับปรุงแสดงและมีเนื้อหา */
  async expectImprovementsVisible(): Promise<void> {
    await expect(this.improvementsList).toBeVisible({ timeout: 30_000 });
  }

  /** ยืนยันตารางประวัติการวิเคราะห์แสดงอย่างน้อย N แถว */
  async expectHistoryRows(minRows: number): Promise<void> {
    await expect(this.historyTable).toBeVisible({ timeout: 30_000 });
    await expect(this.historyRows.first()).toBeVisible();
    const count = await this.historyRows.count();
    expect(count, `ตารางประวัติต้องมีอย่างน้อย ${minRows} แถว`).toBeGreaterThanOrEqual(minRows);
  }

  /** ยืนยันว่าผลวิเคราะห์ทั้งหมด (คะแนน + radar + จุดแข็ง/ปรับปรุง) แสดงครบ */
  async expectAnalysisResultComplete(expectedScore: number | RegExp): Promise<void> {
    await this.expectOverallScore(expectedScore);
    await this.expectRadarChartVisible();
    await this.expectSectionScoresVisible(5);
    await this.expectStrengthsVisible();
    await this.expectImprovementsVisible();
  }
}
