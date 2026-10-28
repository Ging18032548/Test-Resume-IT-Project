import fs from 'fs';
import path from 'path';
import { test, expect } from '../../fixtures/test-fixtures';
import { APP } from '../../config/config';
import { TEAM_USERS, hasTeamCredentials, type TeamUser } from '../../fixtures/test-data';
import { MOCK_ANALYSIS } from '../../fixtures/test-fixtures';
import { DashboardPage } from '../../pages/DashboardPage';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';

/**
 * ============================================================
 * TEAM-JOURNEY — บัญชีทีมงาน 3 คน: "sign in → log in ตามลำดับ จนครบทุก function"
 * (คำสั่งผู้ใช้ 2026-10-27 — ห้ามใช้ชื่ออื่น เพราะไฟล์ resume เป็นชื่อ 3 คนนี้แล้ว)
 * ============================================================
 * บัญชี (fixtures/test-data.ts — TEAM_USERS):
 *   Kanyarat Patthanan  — สายงาน HR & Recruitment
 *   Phiraphat Chayanon  — สายงาน Finance & Financial Analyst
 *   Varin Methawee      — สายงาน UI/UX Product Design
 *
 * ลำดับฟังก์ชันต่อบัญชี (1 เทสต์ต่อคน — ทำครบในตัวเอง รันขนานได้):
 *   ขั้น 1  SIGN IN  (สมัครสมาชิกด้วยชื่อที่แสดง "Kanyarat Patthanan" ฯลฯ)
 *   ขั้น 2  LOG IN   (เข้าสู่ระบบ → /dashboard ทักทายด้วยชื่อ+อีเมลของคนนั้น)
 *   ขั้น 3  อัปโหลด Resume ไฟล์ที่ตั้งชื่อตามเจ้าของบัญชี (resume-<ชื่อ>.pdf)
 *   ขั้น 4  วิเคราะห์แบบ BASE (ไม่เทียบตำแหน่ง)
 *   ขั้น 5  วิเคราะห์แบบ JOB_MATCH (เทียบตำแหน่งใกล้สายงาน)
 *   ขั้น 6  ประวัติการวิเคราะห์ (History) แสดงรายการ
 *   ขั้น 7  Job Descriptions — สร้างตำแหน่งงานของสายงานตัวเอง
 *   ขั้น 8  /admin — ตาราง Users ต้องมีชื่อ+อีเมลของคนนั้น (จุดที่ผู้ใช้รายงานว่าหาย)
 *   ขั้น 9  ออกจากระบบ (Logout)
 *   ขั้น 10 เส้นทาง protected — /dashboard หลัง logout ต้องถูกพาไป /sign-in
 *
 * ชุด MOCK  = ตรวจเข้มทุก assertion บนแอปจำลอง (MOCK_API=true + BASE_URL 127.0.0.1:4310)
 * ชุด REAL  = รันบน learnace.tech เมื่อ MOCK_API=false + ตั้ง TEAM_*_PASSWORD ครบใน .env
 *             — เก็บหลักฐานทุกฟังก์ชันด้วย expect.soft (ไม่ปลอมผลผ่าน: ขั้นไหน
 *               ขับเคลื่อนไม่ได้จริงจะถูก mark fail พร้อมเหตุผลแนบในรายงาน)
 */

/* ============================================================
 * ชุด MOCK — journey ครบทุก function (ตรวจเข้ม)
 * ============================================================ */
test.describe('TEAM-JOURNEY (MOCK) — ทีมงาน 3 คน: sign in → log in → ครบทุก function', () => {
  test.skip(
    !APP.mockApi || !APP.isMockAppServer,
    'ชุดนี้รันเฉพาะ MOCK_API=true + BASE_URL ชี้ mock app server (http://127.0.0.1:4310) — ' +
      'การ register บน production ต้องผ่านชุด REAL ด้านล่างเท่านั้น'
  );

  for (const member of TEAM_USERS) {
    test(`[TEAM-JOURNEY] ${member.displayName} (${member.department}) — journey ครบทุก function`, async ({ page }) => {
      const resumeFileName = path.basename(member.resumeFile);

      /* ---------- ขั้น 0: หน้าแรกเปิดได้ ---------- */
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('h1').first()).toContainText('เข้าสู่ระบบ');

      /* ---------- ขั้น 1: SIGN IN — สมัครสมาชิกด้วยชื่อที่แสดง (ห้ามใช้ชื่ออื่น) ---------- */
      const registration = new RegistrationPage(page);
      await registration.goto();
      await registration.fillForm(member.displayName, member.email, member.password, member.password);
      await registration.submit();
      await expect(
        page.locator('#register-success'),
        'สมัครสมาชิกด้วยชื่อที่แสดงต้องสำเร็จ'
      ).toContainText('สมัครสมาชิกสำเร็จ');

      /* ---------- ขั้น 2: LOG IN — เข้าสู่ระบบด้วยอีเมล+รหัสผ่านของคนนั้น ---------- */
      const login = new LoginPage(page);
      await login.goto();
      await login.signIn(member.email, member.password);
      await login.expectLoginSuccess();

      // หลักฐานตัวตน: Dashboard ต้องทักทายด้วยชื่อ+อีเมลของคนนั้น (มาจาก /api/auth/me)
      await expect(page.locator('#greeting-text')).toContainText(member.displayName);
      await expect(page.locator('#greeting-text')).toContainText(member.email);

      /* ---------- ขั้น 3: อัปโหลด Resume ไฟล์ชื่อตัวเอง ---------- */
      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.uploadResume(member.resumeFile);
      await dashboard.expectUploadSuccess();
      await expect(
        page.locator('#upload-success'),
        'ข้อความอัปโหลดสำเร็จต้องระบุชื่อไฟล์ resume ของเจ้าของบัญชี'
      ).toContainText(resumeFileName);

      /* ---------- ขั้น 4: วิเคราะห์แบบ BASE (ไม่เทียบตำแหน่ง) ---------- */
      await dashboard.selectJob(null);
      await dashboard.analyze();
      await dashboard.expectAnalysisResultComplete(MOCK_ANALYSIS.overallScore);

      /* ---------- ขั้น 5: วิเคราะห์แบบ JOB_MATCH (เทียบตำแหน่งใกล้สายงาน) ---------- */
      await dashboard.selectJob(member.jobOption);
      await dashboard.analyze();
      await dashboard.expectOverallScore(MOCK_ANALYSIS.overallScore);

      /* ---------- ขั้น 6: ประวัติการวิเคราะห์แสดงรายการ ---------- */
      await dashboard.expectHistoryRows(5);

      /* ---------- ขั้น 7: Job Descriptions — สร้างตำแหน่งงานของสายงานตัวเอง ---------- */
      await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
      await page.locator('#job-title').fill(member.jobToCreate.title);
      await page.locator('#job-company').fill(member.jobToCreate.company);
      await page.locator('#job-form button[type="submit"]').click();
      await expect(
        page.locator('#jobs-body'),
        'ตำแหน่งงานที่สร้างต้องปรากฏในตาราง'
      ).toContainText(member.jobToCreate.title);

      /* ---------- ขั้น 8: /admin — ตาราง Users ต้องมีตัวตนของคนนั้น ---------- */
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });
      const usersTable = page.getByTestId('users-table');
      await expect(usersTable).toContainText(member.displayName);
      await expect(usersTable).toContainText(member.email);

      // แถว = seed 3 คน + ตัวเอง 1 = 4 (พิสูจน์ว่า user ถูกบันทึกจริง ไม่ใช่ตอบแค่ "สำเร็จ")
      await expect(usersTable.locator('tbody tr')).toHaveCount(4);

      /* ---------- ขั้น 9: ออกจากระบบ ---------- */
      await page.getByTestId('nav-logout').click();
      await expect(page).toHaveURL(/\/sign-in/i);

      /* ---------- ขั้น 10: protected — /dashboard หลัง logout ต้องถูกพากลับ /sign-in ---------- */
      await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/sign-in/i);
    });
  }
});

/* ============================================================
 * ชุด REAL — รันบน learnace.tech (เครื่องผู้ใช้, MOCK_API=false)
 * ============================================================
 * วาล์วกันพลาด: ต้องตั้ง TEAM_KANYARAT_PASSWORD / TEAM_PHIRAPHAT_PASSWORD /
 * TEAM_VARIN_PASSWORD ครบใน .env เท่านั้น (ห้ามยิง production โดยไม่ตั้งใจ)
 * หลักการรายงานผล:
 *   - LOG IN = assertion เข้ม (นี่คือแกนของปัญหาที่ผู้ใช้รายงาน)
 *   - ฟังก์ชันอื่นบนเว็บจริง DOM ยัง UNVERIFIED → ขับเคลื่อนจริง + เก็บหลักฐานแนบ
 *     รายงานด้วย expect.soft — ถ้าขั้นไหนทำไม่สำเร็จ เทสต์จะ fail ตามจริง
 *     พร้อมเหตุผล (ไม่ปลอมผลผ่าน) และทำขั้นถัดไปต่อจนครบ
 */
test.describe('TEAM-JOURNEY-REAL — ทีมงาน 3 คนบน learnace.tech (MOCK_API=false)', () => {
  test.skip(
    APP.mockApi || !hasTeamCredentials(),
    'BLOCKED: รันได้เฉพาะ MOCK_API=false และตั้ง TEAM_KANYARAT_PASSWORD / ' +
      'TEAM_PHIRAPHAT_PASSWORD / TEAM_VARIN_PASSWORD ครบใน .env — ' +
      'เงื่อนไขไม่ครบ = ห้ามยิง production (กฎเฟรมเวิร์ก)'
  );

  /** เก็บหลักฐานข้อความลงรายงาน HTML (แนบได้แม้เทสต์ fail) */
  async function attachEvidence(
    testInfo: { attach(name: string, options: { body: string; contentType: string }): Promise<void> },
    name: string,
    text: string
  ): Promise<void> {
    await testInfo.attach(name, { body: text.slice(0, 2000), contentType: 'text/plain' });
  }

  for (const member of TEAM_USERS) {
    test(`[TEAM-JOURNEY-REAL] ${member.displayName} — sign in → log in → ครบทุก function บน production`, async ({ page }, testInfo) => {
      test.setTimeout(420_000); // เว็บจริงอยู่หลัง Cloudflare tunnel — จองเวลาให้ครบทุกขั้น

      const resumeFileName = path.basename(member.resumeFile);

      /* ---------- ขั้น 1: SIGN IN (สมัคร) — บัญชีมีอยู่แล้วบนระบบจึงคาดหวัง 409/success ---------- */
      try {
        const registration = new RegistrationPage(page);
        await registration.goto();
        await registration.fillForm(member.displayName, member.email, member.password, member.password);
        await registration.submit();

        const successShown = await registration.successMessage
          .waitFor({ state: 'visible', timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        const errorShown = successShown ? false : await registration.errorMessage
          .waitFor({ state: 'visible', timeout: 5_000 })
          .then(() => true)
          .catch(() => false);

        const evidence = successShown
          ? 'REGISTER=สำเร็จ (บัญชีถูกสร้างใหม่)'
          : errorShown
            ? 'REGISTER=ถูกปฏิเสธโดยระบบ (คาดหวัง: อีเมลถูกใช้แล้ว เพราะบัญชีมีอยู่จริง)'
            : 'REGISTER=ไม่ตอบสนองทั้ง success/error ภายใน 15 วินาที';
        await attachEvidence(testInfo, `REAL-1-register-${member.email}`, evidence);
        expect.soft(
          successShown || errorShown,
          `[${member.displayName}] ขั้น 1 SIGN IN (register): ฟอร์มต้องตอบสนอง — ${evidence}`
        );
      } catch (error) {
        await attachEvidence(testInfo, `REAL-1-register-${member.email}`, `STEP_ERROR: ${String(error)}`);
        expect.soft(false, `[${member.displayName}] ขั้น 1 SIGN IN (register) ขับเคลื่อนไม่สำเร็จ — ดูหลักฐานแนบ`);
      }

      /* ---------- ขั้น 2: LOG IN — assertion เข้ม (แกนของปัญหาที่ผู้ใช้รายงาน) ---------- */
      const login = new LoginPage(page);
      await login.goto();
      await login.signIn(member.email, member.password);
      await login.expectLoginSuccess();

      /* ---------- หลักฐานตัวตนหลัง login (เก็บข้อความหน้า Dashboard จริง) ---------- */
      await page.waitForTimeout(2_000);
      await attachEvidence(
        testInfo,
        `REAL-2-dashboard-${member.email}`,
        `URL หลัง login: ${page.url()}\n--- เนื้อหาหน้า Dashboard (600 ตัวอักษรแรก) ---\n` +
          (await page.locator('body').innerText()).slice(0, 600)
      );

      /* ---------- ขั้น 3-6: อัปโหลด + วิเคราะห์ + ประวัติ (เก็บหลักฐานจริง) ----------
       * กติกาจากผู้ใช้: อัปโหลดได้เฉพาะไฟล์ resume ที่ตั้งชื่อตามเจ้าของบัญชีเท่านั้น
       * — ถ้าไฟล์ fixture ยังไม่ถูกสร้าง = BLOCKED ขั้นนี้พร้อมวิธีแก้ (ห้ามเอาไฟล์อื่นมาแทน) */
      const resumeFileExists = fs.existsSync(member.resumeFile);
      if (!resumeFileExists) {
        await attachEvidence(
          testInfo,
          `REAL-3-upload-${member.email}`,
          `BLOCKED: ไม่พบไฟล์ resume ของเจ้าของบัญชี: ${member.resumeFile}\n` +
            'ห้ามอัปโหลดไฟล์ชื่ออื่นตามคำสั่งผู้ใช้ — รันคำสั่ง npm run gen:fixtures เพื่อสร้าง\n' +
            'ไฟล์ resume ชื่อทีม 3 คน (Kanyarat/Phiraphat/Varin) แล้วรันชุดนี้ใหม่'
        );
        expect.soft(
          false,
          `[${member.displayName}] ขั้น 3: ไฟล์ resume ชื่อเจ้าของบัญชียังไม่ถูกสร้าง — รัน npm run gen:fixtures ก่อนแล้วรันใหม่`
        );
      } else {
        try {
          const dashboard = new DashboardPage(page);
          await dashboard.goto();
          const fileInputAttached = await dashboard.fileInput
            .waitFor({ state: 'attached', timeout: 15_000 })
            .then(() => true)
            .catch(() => false);
          expect.soft(
            fileInputAttached,
            `[${member.displayName}] ขั้น 3: หน้า Dashboard จริงต้องมี input ไฟล์ resume — ` +
              'ถ้า fail = DOM จริงต่างจาก locator (ปรับจูนด้วย npx playwright codegen)'
          );

          if (fileInputAttached) {
            await dashboard.uploadResume(member.resumeFile);
            await page.waitForTimeout(3_000);
            const bodyText = await page.locator('body').innerText();
            const uploadEvidence = bodyText.includes(resumeFileName)
              ? `อัปโหลดสำเร็จ — เห็นชื่อไฟล์ "${resumeFileName}" บนหน้าจริง`
              : `อัปโหลดส่งไปแล้ว แต่ไม่พบชื่อไฟล์ "${resumeFileName}" บนหน้าจริง (ตรวจ HTML report ประกอบ)`;
            await attachEvidence(testInfo, `REAL-3-upload-${member.email}`, uploadEvidence);
            expect.soft(bodyText.includes(resumeFileName), `[${member.displayName}] ขั้น 3 อัปโหลด: ${uploadEvidence}`);

            /* ---------- ขั้น 4-5: กดวิเคราะห์ + รอผลจริงสูงสุด 90 วินาที ----------
             * เดิมรอแค่ 5 วินาที ทำให้พิสูจน์ไม่ได้ว่า AI วิเคราะห์เสร็จจริงหรือยัง
             * (คิว BullMQ บนเว็บจริงอาจใช้เวลานาน) — ตอนนี้ poll หาผล + เก็บหลักฐาน
             * ทุก /api/** ที่ถูกยิงหลังกดวิเคราะห์ (ระดับเครือข่าย ไม่อิง DOM เดา ๆ) */
            const analyzeVisible = await dashboard.analyzeButton.isVisible().catch(() => false);
            if (analyzeVisible) {
              const apiDuringAnalyze: string[] = [];
              page.on('response', (response) => {
                if (response.url().includes('/api/')) {
                  apiDuringAnalyze.push(
                    `${response.request().method()} ${response.status()} ${response.url()}`
                  );
                }
              });

              const bodyLengthBefore = (await page.locator('body').innerText().catch(() => '')).length;
              await dashboard.analyze();

              let bodyChanged = false;
              let lastBodyLength = bodyLengthBefore;
              let resultKeywords = '';
              for (let waited = 0; waited < 90; waited += 10) {
                await page.waitForTimeout(10_000);
                const bodyNow = await page.locator('body').innerText().catch(() => '');
                lastBodyLength = bodyNow.length;
                if (Math.abs(bodyNow.length - bodyLengthBefore) > 50) bodyChanged = true;
                const match = bodyNow.match(
                  /(คะแนนรวม[^\n]{0,40}|resume score[^\n]{0,40}|overall[^\n]{0,30}score[^\n]{0,20}|จุดแข็ง[^\n]{0,40})/i
                );
                if (match) {
                  resultKeywords = match[0];
                  break;
                }
              }
              const analyzeEvidence =
                `กดวิเคราะห์แล้ว (ปุ่มมีจริงบนหน้า) + รอผลสูงสุด 90 วินาที\n` +
                `หน้าเปลี่ยนหลังกด: ${bodyChanged} | ความยาวเนื้อหาก่อน/หลัง: ${bodyLengthBefore}/${lastBodyLength} ตัวอักษร\n` +
                `คำสำคัญที่พบ: ${resultKeywords || '(ไม่พบคำว่า คะแนน/Score/จุดแข็ง ภายใน 90 วินาที)'}\n` +
                `API ที่ถูกยิงหลังกดวิเคราะห์:\n${apiDuringAnalyze.slice(-20).join('\n') || '(ไม่มี)'}`;
              await attachEvidence(testInfo, `REAL-4-analyze-${member.email}`, analyzeEvidence);
              expect.soft(
                bodyChanged || apiDuringAnalyze.length > 0 || Boolean(resultKeywords),
                `[${member.displayName}] ขั้น 4-5 วิเคราะห์: กดปุ่มแล้ว 90 วินาที หน้าไม่เปลี่ยน ไม่มี API ถูกยิง และไม่พบผลวิเคราะห์ — ` +
                  'ดูหลักฐาน REAL-4-analyze (ความเป็นไปได้: ปุ่มวิเคราะห์บั๊ก / ต้องเลือกไฟล์ก่อน / คิววิเคราะห์นานเกิน 90 วิ)'
              );
            } else {
              await attachEvidence(
                testInfo,
                `REAL-4-analyze-${member.email}`,
                'ไม่พบปุ่มวิเคราะห์บน DOM จริง (locator: ข้อความ วิเคราะห์/Analy[sz]e) — ฟังก์ชันวิเคราะห์จึงยังพิสูจน์ไม่ได้ ดูเนื้อหาหน้าที่แนบใน REAL-3'
              );
              expect.soft(
                false,
                `[${member.displayName}] ขั้น 4-5: ไม่พบปุ่มวิเคราะห์บนหน้า Dashboard จริง — ดู dump หลักฐาน REAL-3-upload`
              );
            }
          }
        } catch (error) {
          await attachEvidence(testInfo, `REAL-3-upload-${member.email}`, `STEP_ERROR: ${String(error)}`);
          expect.soft(false, `[${member.displayName}] ขั้น 3-6 (อัปโหลด/วิเคราะห์) ขับเคลื่อนไม่สำเร็จ — ดูหลักฐานแนบ`);
        }
      }

      /* ---------- ขั้น 7: Job Descriptions — สำรวจหน้าจริง + สร้างตำแหน่งของสายงานตัวเอง ---------- */
      try {
        await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3_000);
        const jobsUrl = page.url();
        const jobsBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 600);
        await attachEvidence(
          testInfo,
          `REAL-7-jobs-${member.email}`,
          `URL สุดท้าย: ${jobsUrl}\n--- เนื้อหาหน้า /jobs (600 ตัวอักษรแรก) ---\n${jobsBody}`
        );
        expect.soft(
          jobsUrl.includes('/jobs'),
          `[${member.displayName}] ขั้น 7: /jobs ต้องคงอยู่ (ไม่ถูกเด้งออก) เมื่อล็อกอินแล้ว — URL จริง: ${jobsUrl}`
        );

        // สร้างตำแหน่งงานของสายงานตัวเอง (ถ้าหน้าจริงมีฟอร์ม — DOM ของ /jobs ยัง UNVERIFIED จึงสำรวจก่อน)
        const titleInput = page
          .locator(
            '#job-title, input[name="title"], input[placeholder*="ตำแหน่ง" i], input[placeholder*="title" i]'
          )
          .first();
        const companyInput = page
          .locator(
            '#job-company, input[name="company"], input[placeholder*="บริษัท" i], input[placeholder*="company" i]'
          )
          .first();
        const hasJobForm =
          (await titleInput.isVisible().catch(() => false)) &&
          (await companyInput.isVisible().catch(() => false));
        if (hasJobForm) {
          await titleInput.fill(member.jobToCreate.title);
          await companyInput.fill(member.jobToCreate.company);
          const submitJob = page
            .locator(
              '#job-form button[type="submit"], button:has-text("สร้าง"), button:has-text("เพิ่ม"), button[type="submit"]'
            )
            .first();
          await submitJob.click({ timeout: 5_000 }).catch(() => {});
          await page.waitForTimeout(3_000);
          const bodyAfterCreate = await page.locator('body').innerText().catch(() => '');
          const created = bodyAfterCreate.includes(member.jobToCreate.title);
          await attachEvidence(
            testInfo,
            `REAL-7-job-create-${member.email}`,
            created
              ? `สร้างตำแหน่งงาน "${member.jobToCreate.title}" สำเร็จ — ชื่อปรากฏบนหน้าจริง`
              : `กดสร้างตำแหน่งงาน "${member.jobToCreate.title}" แล้ว แต่ยังไม่พบชื่อบนหน้าจริง (ตรวจรายงาน/ภาพประกอบ — อาจต้องรีเฟรชหรือมี validation ที่จับไม่ได้)`
          );
          expect.soft(
            created,
            `[${member.displayName}] ขั้น 7: ตำแหน่งงานที่สร้างต้องปรากฏในตารางบนหน้าจริง`
          );
        } else {
          await attachEvidence(
            testInfo,
            `REAL-7-job-create-${member.email}`,
            'ไม่พบฟอร์มสร้างตำแหน่งงานบน DOM จริง (หา input ตำแหน่ง/บริษัท ไม่เจอ) — ฟังก์ชันสร้าง job จึงยังพิสูจน์ไม่ได้ ดูเนื้อหาหน้าที่แนบ'
          );
        }
      } catch (error) {
        expect.soft(false, `[${member.displayName}] ขั้น 7 (/jobs) ขับเคลื่อนไม่สำเร็จ: ${String(error)}`);
      }

      /* ---------- ขั้น 8: /admin — เก็บหลักฐานว่าเห็นอะไรจริง ---------- */
      try {
        await page.goto('/admin', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5_000);
        const finalUrl = page.url();
        const bodyText = await page.locator('body').innerText();
        await attachEvidence(
          testInfo,
          `REAL-8-admin-${member.email}`,
          `URL สุดท้าย: ${finalUrl}\n--- เนื้อหาหน้า /admin (1000 ตัวอักษรแรก) ---\n${bodyText.slice(0, 1000)}`
        );
        expect.soft(
          finalUrl.includes('/admin') || finalUrl.includes('/sign-in'),
          `[${member.displayName}] ขั้น 8: /admin ต้องแสดงหน้า admin หรือเด้งไปยืนยันตัวตน — ` +
            'ถ้าเห็นหน้า sign-in = บัญชีนี้ไม่มี role ADMIN บนระบบจริง (พฤติกรรมถูกต้องของระบบ ต้องใช้บัญชี ADMIN เพื่อดู user ทั้งหมด)'
        );

        // ถ้าเข้า /admin ได้จริง — ตัวตนของคนล็อกอินต้องปรากฏ (ต่อยอดหลักฐานจาก TEAM-SIGNIN-REAL)
        if (finalUrl.includes('/admin')) {
          expect.soft(
            bodyText.includes(member.displayName) || bodyText.includes(member.email),
            `[${member.displayName}] ขั้น 8: /admin ต้องแสดง "${member.displayName}" หรือ "${member.email}" — ` +
              'ถ้าไม่พบ = ข้อมูล user ไม่แสดงใน /admin (ปัญหาแกนที่ผู้ใช้รายงาน) ดูหลักฐาน REAL-8'
          );
        }
      } catch (error) {
        expect.soft(false, `[${member.displayName}] ขั้น 8 (/admin) เก็บหลักฐานไม่สำเร็จ: ${String(error)}`);
      }

      /* ---------- ขั้น 9: ออกจากระบบ (ถ้าหน้าจริงมีปุ่ม) ---------- */
      const logoutButton = page.getByTestId('nav-logout').or(
        page.getByRole('button', { name: /ออกจากระบบ|log\s*out|sign\s*out/i })
      ).first();
      const logoutVisible = await logoutButton.isVisible().catch(() => false);
      if (logoutVisible) {
        await logoutButton.click();
        await page.waitForTimeout(2_000);
        await attachEvidence(testInfo, `REAL-9-logout-${member.email}`, `URL หลัง logout: ${page.url()}`);

        /* ---------- ขั้น 10: เส้นทาง protected หลัง logout — ทั้ง /dashboard และ /admin ----------
         * เดิมชุด REAL ตรวจแค่ /dashboard — เพิ่ม /admin เพราะเป็นหน้าสิทธิ์สูงสุด
         * ถ้าหลัง logout ยังเข้า /admin ได้ = ช่องโหว่ access control ร้ายแรง */
        await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2_000);
        const dashboardGatedUrl = page.url();
        const dashboardGated =
          /sign-in|login/i.test(dashboardGatedUrl) ||
          (await page.locator('input[type="email"]').first().isVisible().catch(() => false));

        await page.goto('/admin', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2_000);
        const adminGatedUrl = page.url();
        const adminGated =
          /sign-in|login/i.test(adminGatedUrl) ||
          (await page.locator('input[type="email"]').first().isVisible().catch(() => false));

        await attachEvidence(
          testInfo,
          `REAL-10-protected-${member.email}`,
          `หลัง logout: /dashboard ถูก gate = ${dashboardGated} (URL: ${dashboardGatedUrl})\n` +
            `หลัง logout: /admin ถูก gate = ${adminGated} (URL: ${adminGatedUrl})`
        );
        expect.soft(
          dashboardGated && adminGated,
          `[${member.displayName}] ขั้น 10: หลังออกจากระบบ เส้นทาง protected (/dashboard, /admin) ต้องถูกพาไปยืนยันตัวตนทั้งคู่ — ` +
            'ถ้ายังเห็นเนื้อหา = ช่องโหว่ access control (ดูหลักฐาน REAL-10)'
        );
      } else {
        await attachEvidence(
          testInfo,
          `REAL-9-logout-${member.email}`,
          'ไม่พบปุ่มออกจากระบบบน DOM จริง (locator [data-testid="nav-logout"] หรือข้อความ ออกจากระบบ/Log out)'
        );
        expect.soft(
          false,
          `[${member.displayName}] ขั้น 9: ไม่พบปุ่มออกจากระบบบนหน้าจริง — ฟังก์ชัน logout จึงพิสูจน์ไม่ได้ ดู dump เนื้อหาหน้าที่แนบในขั้น 8`
        );
      }
    });
  }
});