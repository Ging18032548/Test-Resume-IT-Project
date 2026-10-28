import { test, expect } from '../../fixtures/test-fixtures';
import { DashboardPage } from '../../pages/DashboardPage';
import {
  FIXTURE_FILES,
  JOB_OPTIONS,
} from '../../fixtures/test-data';
import {
  buildFakePdfBytes,
  buildOversizedPdfBytes,
  buildValidPdfBytes,
  createTempFile,
} from '../../helpers/test-data-factory';
import { MOCK_ANALYSIS } from '../../fixtures/test-fixtures';

/**
 * ============================================================
 * Dashboard — อัปโหลด Resume + วิเคราะห์ด้วย AI (User Journey หลัก)
 * ============================================================
 * อ้างอิง Test Plan: TC-DSH-001 .. TC-DSH-007 (docs/test-plan.md)
 *
 * Flow จริงของผลิตภัณฑ์ (จากหน้าแรก + repo อ้างอิง):
 *   เข้าสู่ระบบ → อัปโหลด PDF → เลือกตำแหน่งงาน (ถ้าต้องการเทียบ)
 *   → กด "วิเคราะห์ Resume" → ผลลัพธ์: คะแนนรวม + Radar Chart
 *   + Section Scores + จุดแข็ง + จุดที่ควรปรับปรุง + ประวัติ
 *
 * Mocked Persistence: ผลลัพธ์ทั้งหมดมาจาก stateful mock (page.route)
 * — ไม่มีข้อมูลเข้าฐานข้อมูลจริง และ state หายเมื่อเทสต์จบ
 */

test.describe('Dashboard — User Journey หลัก (Mock API)', () => {
  test('[TC-DSH-001] อัปโหลด PDF ถูกต้อง → อัปโหลดสำเร็จ', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.uploadResume(FIXTURE_FILES.validResumePdf);
    await dashboard.expectUploadSuccess();
  });

  test('[TC-DSH-002] อัปโหลด + เลือกตำแหน่งงาน + วิเคราะห์ → แสดงคะแนนรวมและ Radar Chart', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.uploadAndAnalyze(FIXTURE_FILES.validResumePdf, JOB_OPTIONS.frontend);

    // คะแนนรวม 82 มาจาก mock payload (ตรวจว่า UI render ผลวิเคราะห์จริง)
    await dashboard.expectAnalysisResultComplete(MOCK_ANALYSIS.overallScore);
  });

  test('[TC-DSH-003] ผลวิเคราะห์แสดงจุดแข็ง (ข้อดี) และจุดที่ควรปรับปรุงครบถ้วน', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.uploadAndAnalyze(FIXTURE_FILES.validResumePdf, null);

    await dashboard.expectStrengthsVisible();
    await dashboard.expectImprovementsVisible();

    // เนื้อหาจาก mock payload ต้องปรากฏบนหน้าจริง (ไม่ใช่แค่กล่องว่าง)
    await expect(authedPage.locator('body')).toContainText('ประสบการณ์ทำงานเขียนได้ชัดเจน');
  });

  test('[TC-DSH-004] Section Scores แสดงรายตัวชี้วัดครบ (ข้อมูล Radar 7 แกน)', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.uploadAndAnalyze(FIXTURE_FILES.validResumePdf, null);
    await dashboard.expectSectionScoresVisible(5);
  });

  test('[TC-DSH-005] ประวัติการวิเคราะห์ (History) แสดงอย่างน้อย 5 รายการจาก mock state', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.expectHistoryRows(5);
  });

  test('[TC-DSH-006] Data Persistence หลัง Refresh — ประวัติยังแสดง (mock state คืนค่าเหมือนเดิม)', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.uploadAndAnalyze(FIXTURE_FILES.validResumePdf, null);
    await dashboard.expectAnalysisResultComplete(MOCK_ANALYSIS.overallScore);

    await authedPage.reload({ waitUntil: 'domcontentloaded' });
    await dashboard.expectHistoryRows(5);
  });

  test('[TC-DSH-007] ไฟล์ปลอม (นามสกุล .pdf แต่ไม่ใช่ PDF) → ถูกปฏิเสธพร้อมข้อความ error', async ({ authedPage }) => {
    const fake = createTempFile('not-a-real-cv.pdf', buildFakePdfBytes());
    try {
      const dashboard = new DashboardPage(authedPage);
      await dashboard.goto();

      await dashboard.uploadResume(fake.path);
      await dashboard.expectUploadRejected(/ไฟล์|file|ไม่ถูกต้อง|invalid/i);
    } finally {
      fake.cleanup();
    }
  });

  test('[TC-DSH-008] ไฟล์ใหญ่เกิน 5MB (boundary เกิน) → ถูกปฏิเสธ', async ({ authedPage }) => {
    const oversized = createTempFile('oversized-resume.pdf', buildOversizedPdfBytes());
    try {
      const dashboard = new DashboardPage(authedPage);
      await dashboard.goto();

      await dashboard.uploadResume(oversized.path);
      await dashboard.expectUploadRejected(/ขนาด|size|เกิน|5MB/i);
    } finally {
      oversized.cleanup();
    }
  });

  test('[TC-DSH-009] วิเคราะห์แบบเทียบตำแหน่งงาน (JOB_MATCH) → ผลยังแสดงครบทุกส่วน', async ({ authedPage }) => {
    const dashboard = new DashboardPage(authedPage);
    await dashboard.goto();

    await dashboard.uploadAndAnalyze(FIXTURE_FILES.validResumePdf, JOB_OPTIONS.qa);

    await dashboard.expectAnalysisResultComplete(MOCK_ANALYSIS.overallScore);
    await dashboard.expectHistoryRows(5);
  });

  test('[TC-DSH-010] ไฟล์ PDF สร้างสดรันต่อรัน (ไม่ซ้ำแบบเฉพาะตัว) → journey สมบูรณ์', async ({ authedPage }, testInfo) => {
    const unique = createTempFile(
      `qa-resume-${Date.now()}-${testInfo.retry}.pdf`,
      buildValidPdfBytes(`LearnAce QA run ${Date.now()}\nNode.js React SQL`)
    );
    try {
      const dashboard = new DashboardPage(authedPage);
      await dashboard.goto();

      await dashboard.uploadAndAnalyze(unique.path, JOB_OPTIONS.backend);
      await dashboard.expectAnalysisResultComplete(MOCK_ANALYSIS.overallScore);
    } finally {
      unique.cleanup();
    }
  });
});
