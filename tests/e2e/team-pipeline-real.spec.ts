import fs from 'fs';
import path from 'path';
import { test, expect, type Page, type Response } from '@playwright/test';
import { APP } from '../../config/config';
import {
  TEAM_USERS,
  hasTeamCredentials,
  FIXTURE_FILES_DIR,
  type TeamUser,
} from '../../fixtures/test-data';
import { MOCK_ANALYSIS } from '../../fixtures/test-fixtures';
import { LoginPage } from '../../pages/LoginPage';
import { DashboardPage } from '../../pages/DashboardPage';

/**
 * ============================================================
 * TEAM-PIPE-REAL — pipeline ครบวงจรบน learnace.tech จริง
 * "อัปโหลด resume จริง → วิเคราะห์ด้วย AI จริง → ผลวิเคราะห์/Job Match
 *  → ประวัติ → Job Descriptions → ฟังก์ชันเสริมให้ครบที่มีบนเว็บ"
 * (คำสั่งผู้ใช้ 2026-10-28; MOCK_API=false + บัญชีทีมจาก .env เท่านั้น
 *  — เงื่อนไขไม่ครบ = BLOCKED ตามกฎเฟรมเวิร์ก)
 * ============================================================
 * ไฟล์ resume ที่ใช้อัปโหลด (ตามภาพโครงสร้างที่ผู้ใช้ยืนยัน 2026-10-28):
 *   1) โฟลเดอร์ resume/ ของโปรเจกต์ — ไฟล์จริงของทีม
 *      (Resume_Kanyarat_*.pdf / Resume_Phiraphat_*.pdf / Resume_Varin_*.pdf)
 *      จับด้วย "ชื่อต้นในชื่อไฟล์" ไม่ผูกสะกดเป๊ะ เพราะสะกดจริงบนไฟล์
 *      เช่น Patthanant/Chayanont อาจต่างจากในระบบเล็กน้อย
 *   2) ถ้าไม่มี → fixtures/files/resume-<ชื่อ>.pdf ที่ gen:fixtures สร้าง
 *   3) ไม่มีทั้งคู่ = BLOCKED + เหตุผล (ไม่ปลอมไฟล์อัปโหลด)
 *
 * สิ่งที่ชุดนี้วัดเพิ่มจาก TEAM-JOURNEY-REAL (ที่รอแค่ 5 วิหลังกดวิเคราะห์):
 *   - รอผลวิเคราะห์ "จนเสร็จจริง" สูงสุด 300 วิ (poll ทุก 5 วิ + timeline หลักฐาน)
 *   - ยืนยันผลวิเคราะห์: คะแนนตัวเลข, จุดแข็ง, จุดที่ควรปรับปรุง (ตาม inventory §3.3)
 *   - วิเคราะห์แบบ JOB_MATCH (เลือกตำแหน่งก่อนกดวิเคราะห์) ทุกคน
 *   - จับหลักฐานระดับเครือข่ายทุก call /api/resumes|/api/analyses|/api/jobs
 *   - /jobs สร้างตำแหน่งงานจริง + ผลลัพธ์บนหน้า
 *   - ฟังก์ชันเสริม: /resumes/upload โดยตรง, อัปโหลดไฟล์ผิดชนิดต้องถูกปฏิเสธ,
 *     /privacy (ลิงก์ที่หน้า login อ้างถึง — สถานะ UNVERIFIED ใน inventory §2)
 *
 * ข้อจำกัดที่รายงานตรงไปตรงมา: DOM หลัง login ของเว็บจริงยัง UNVERIFIED
 * (สำรวจได้เฉพาะหน้าก่อน login) — locator ทั้งหมด multi-fallback และทุกขั้น
 * แนบ dump จริง: ถ้า DOM ต่างจากคาด เทสต์ fail พร้อมหลักฐาน ไม่เดา ไม่ปลอมผล
 */

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/* ============================================================
 * ชุด MOCK — พิสูจน์ pipeline logic บนแอปจำลอง (รันได้ทุกเครื่อง)
 * ============================================================ */
test.describe('TEAM-PIPE (MOCK) — pipeline อัปโหลด → วิเคราะห์ JOB_MATCH → ผล/ประวัติ', () => {
  test.skip(
    !APP.mockApi || !APP.isMockAppServer,
    'ชุดนี้รันเฉพาะ MOCK_API=true + BASE_URL ชี้ mock app server (http://127.0.0.1:4310)'
  );

  for (const member of TEAM_USERS) {
    test(`[TEAM-PIPE] ${member.displayName} — upload → JOB_MATCH analysis → ผลครบ + ประวัติ`, async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto();
      await login.signIn(member.email, member.password);
      await login.expectLoginSuccess();

      const dashboard = new DashboardPage(page);
      await dashboard.goto();
      await dashboard.uploadResume(member.resumeFile);
      await dashboard.expectUploadSuccess();
      await expect(page.locator('#upload-success')).toContainText(path.basename(member.resumeFile));

      /* JOB_MATCH: เลือกตำแหน่งใกล้สายงาน → วิเคราะห์ → ผลต้องครบ */
      await dashboard.selectJob(member.jobOption);
      await dashboard.analyze();
      await dashboard.expectAnalysisResultComplete(MOCK_ANALYSIS.overallScore);

      /* ผลแนบหลักฐาน: คะแนน + จุดแข็ง + จุดปรับปรุง แสดงพร้อมกัน */
      const bodyText = await page.locator('body').innerText();
      expect.soft(bodyText).toContain(String(MOCK_ANALYSIS.overallScore));
      expect.soft(bodyText).toContain(String(MOCK_ANALYSIS.strengths[0]));
      expect.soft(bodyText).toContain(String(MOCK_ANALYSIS.improvements[0]));

      /* ประวัติการวิเคราะห์แสดงรายการ (mock seed 5 แถว) */
      await dashboard.expectHistoryRows(5);
    });
  }
});

/* ============================================================
 * ชุด REAL — learnace.tech จริง (เครื่องผู้ใช้, MOCK_API=false)
 * ============================================================ */
test.describe('TEAM-PIPE-REAL — pipeline ครบวงจรบน learnace.tech (MOCK_API=false)', () => {
  const missingTeamPasswords = [
    'TEAM_KANYARAT_PASSWORD',
    'TEAM_PHIRAPHAT_PASSWORD',
    'TEAM_VARIN_PASSWORD',
  ].filter((key) => !(process.env[key] || '').length);

  test.skip(
    APP.mockApi || !hasTeamCredentials(),
    'BLOCKED: รันได้เฉพาะ MOCK_API=false และตั้งรหัสทีมครบใน .env (กฎเฟรมเวิร์ก: ไม่มีหลักฐานสิทธิ์ = ไม่ยิง production) — ' +
      [
        APP.mockApi
          ? 'MOCK_API ต้องเป็น false ตัวพิมพ์เล็กเป๊ะ ๆ แต่ตอนนี้ = ' + JSON.stringify(process.env.MOCK_API ?? null)
          : null,
        missingTeamPasswords.length > 0 ? 'ยังไม่ได้ตั้งใน .env: ' + missingTeamPasswords.join(', ') : null,
      ]
        .filter(Boolean)
        .join(' | ') +
      ' — ตรวจละเอียดด้วยคำสั่ง: node scripts/check-env.js'
  );

  /** เก็บหลักฐานข้อความลงรายงาน HTML (แนบได้แม้เทสต์ fail) */
  async function attachEvidence(
    testInfo: { attach(name: string, options: { body: string; contentType: string }): Promise<void> },
    name: string,
    text: string
  ): Promise<void> {
    await testInfo.attach(name, { body: text.slice(0, 2400), contentType: 'text/plain' });
  }

  /**
   * หาไฟล์ resume ของสมาชิก — จับจาก "ชื่อต้นในชื่อไฟล์" เพื่อทนสะกดต่าง
   * (ไฟล์จริงของผู้ใช้: Resume_Kanyarat_Patthanant.pdf — สะกดนามสกุลต่างจากระบบ)
   * ลำดับความสำคัญ: resume/ (ไฟล์จริงของทีม) → Resume/ → fixtures/files/
   */
  function findTeamResumeFile(member: TeamUser): { file: string; source: string } | null {
    const searchDirs = [
      path.join(PROJECT_ROOT, 'resume'),
      path.join(PROJECT_ROOT, 'Resume'),
      FIXTURE_FILES_DIR,
    ];
    const firstNameKey = member.firstName.toLowerCase();
    for (const dir of searchDirs) {
      if (!fs.existsSync(dir)) continue;
      const pdfNames = fs
        .readdirSync(dir)
        .filter((name) => name.toLowerCase().endsWith('.pdf'));
      const hit = pdfNames.find((name) => name.toLowerCase().includes(firstNameKey));
      if (hit) return { file: path.join(dir, hit), source: dir.replace(PROJECT_ROOT, '.') };
    }
    if (fs.existsSync(member.resumeFile)) {
      return { file: member.resumeFile, source: 'fixtures/files (exact path)' };
    }
    return null;
  }

  /** จับทุก response ของ API ที่เกี่ยวกับ pipeline เป็นหลักฐานระดับเครือข่าย */
  function trackPipelineApi(page: Page): { calls: string[]; stop(): void } {
    const calls: string[] = [];
    const relevant = /\/api\/(resumes|analyses|analysis|jobs|auth\/me)/i;
    const handler = (response: Response): void => {
      if (relevant.test(response.url())) {
        calls.push(`${response.request().method()} ${response.status()} ${response.url()}`);
      }
    };
    page.on('response', handler);
    return { calls, stop: () => page.off('response', handler) };
  }

  /**
   * เปิดพื้นที่อัปโหลด — ลอง /dashboard ก่อน แล้ว /resumes/upload (inventory §2:
   * route /resumes/upload สถานะ UNVERIFIED — เทสต์นี้จึงพิสูจน์เป็นผลพลอยได้)
   */
  async function openUploadArea(
    page: Page,
    dashboard: DashboardPage
  ): Promise<{ found: boolean; trail: string[]; url: string }> {
    const trail: string[] = [];
    for (const route of ['/dashboard', '/resumes/upload']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4_000);
      trail.push(`${route} -> ${page.url()}`);
      const attached = await dashboard.fileInput
        .waitFor({ state: 'attached', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (attached) return { found: true, trail, url: page.url() };
    }
    return { found: false, trail, url: page.url() };
  }

  /** สถานะที่อ่านได้จากหน้าจริง ณ เวลาหนึ่ง (รวมข้อความไทย+อังกฤษตาม UI จริง) */
  function readPipelineSignals(body: string): { result: boolean; failed: boolean; pending: boolean } {
    const hasScoreWord = /คะแนน|score/i.test(body);
    const hasScoreNumber = /\d{1,3}/.test(body);
    const hasResultContent =
      /จุดแข็ง|strength/i.test(body) ||
      /ปรับปรุง|improve/i.test(body) ||
      /ทักษะ|skill/i.test(body);
    return {
      result: hasScoreWord && hasScoreNumber && hasResultContent,
      failed: !hasScoreWord && /ล้มเหลว|ไม่สำเร็จ|เกิดข้อผิดพลาด|failed/i.test(body),
      pending: /in progress|queued|กำลัง|ประมวลผล|pending|รอผล/i.test(body),
    };
  }

  /**
   * รอผลวิเคราะห์จริงจนเสร็จ — poll ทุก 5 วิ สูงสุด maxMs
   * timeline = สถานะที่เห็นเปลี่ยน ณ วินาทีใด (หลักฐานว่ารอจริง ไม่ใช่ผ่านเฉย ๆ)
   */
  async function pollAnalysis(
    page: Page,
    maxMs: number
  ): Promise<{ outcome: 'result-shown' | 'failed-status' | 'timeout'; timeline: string[]; finalBody: string }> {
    const startedAt = Date.now();
    const timeline: string[] = [];
    let lastSignature = '';
    let lastBody = '';
    while (Date.now() - startedAt < maxMs) {
      await page.waitForTimeout(5_000);
      const body = await page.locator('body').innerText().catch(() => '');
      lastBody = body;
      const signals = readPipelineSignals(body);
      const elapsed = Math.round((Date.now() - startedAt) / 1000);
      const signature = `result=${signals.result} failed=${signals.failed} pending=${signals.pending} url=${page.url()}`;
      if (signature !== lastSignature) {
        timeline.push(`[${String(elapsed).padStart(3, ' ')}s] ${signature}`);
        lastSignature = signature;
      }
      if (signals.result) return { outcome: 'result-shown', timeline, finalBody: body };
      if (signals.failed) return { outcome: 'failed-status', timeline, finalBody: body };
    }
    return { outcome: 'timeout', timeline, finalBody: lastBody };
  }

  /** ดึงบรรทัดที่มีแนวโน้มเป็นคะแนน (คำว่า คะแนน/score/job match + ตัวเลข) จากหน้าจริง */
  function extractScoreLines(body: string): string[] {
    return body
      .split('\n')
      .filter((line) => /คะแนน|score|job.?match|ตรงกับ|ตำแหน่ง/i.test(line) && /\d{1,3}/.test(line))
      .map((line) => line.trim().slice(0, 160))
      .slice(0, 12);
  }

  /** ล็อกอินด้วยบัญชีสมาชิก — throw ถ้า login ไม่ผ่าน (รากปัญหาให้ดูชุด TEAM-SIGNIN-REAL) */
  async function loginMember(page: Page, member: TeamUser): Promise<void> {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(member.email, member.password);
    await login.expectLoginSuccess();
  }

  for (const member of TEAM_USERS) {
    test(`[TEAM-PIPE-REAL] ${member.displayName} — upload resume จริง → วิเคราะห์ JOB_MATCH → รอผลจนเสร็จ → ผลวิเคราะห์ + ประวัติ`, async ({ page }, testInfo) => {
      test.setTimeout(600_000); // รอผลวิเคราะห์ AI จริงสูงสุด 300 วิ + เว็บหลัง tunnel โหลดช้า

      const tracker = trackPipelineApi(page);
      const dashboard = new DashboardPage(page);

      /* ---------- PIPE-A: ล็อกอิน ---------- */
      await loginMember(page, member);

      /* ---------- PIPE-B: หาไฟล์ resume จริงของคนนี้ ---------- */
      const resolved = findTeamResumeFile(member);
      await attachEvidence(
        testInfo,
        `PIPE-resume-file-${member.email}`,
        resolved
          ? `ใช้ไฟล์: ${resolved.file}\nต้นทาง: ${resolved.source}\nขนาด: ${fs.statSync(resolved.file).size} bytes\n` +
            `(โฟลเดอร์ resume/ = ไฟล์จริงของทีมตามที่ผู้ใช้วาง; fixtures/files = ไฟล์ generate)`
          : `BLOCKED: ไม่พบไฟล์ resume ของ ${member.displayName} ทั้งใน resume/, Resume/ และ fixtures/files/ — ` +
            'วางไฟล์จริงไว้ที่ <โปรเจกต์>/resume/ แล้วรันใหม่ (ชื่อไฟล์ต้องมีชื่อต้น เช่น Resume_Kanyarat_...)'
      );
      expect.soft(
        resolved !== null,
        `[PIPE-B] ไม่มีไฟล์ resume ให้อัปโหลดสำหรับ ${member.displayName} — ตามกฎเฟรมเวิร์กจะไม่อัปโหลดไฟล์อื่นแทน (ดูหลักฐาน PIPE-resume-file)`
      );
      if (!resolved) return;

      /* ---------- PIPE-C: เปิดพื้นที่อัปโหลดบนหน้าจริง ---------- */
      const uploadArea = await openUploadArea(page, dashboard);
      await attachEvidence(
        testInfo,
        `PIPE-upload-area-${member.email}`,
        `พบ input ไฟล์: ${uploadArea.found}\nเส้นทางที่ลอง:\n${uploadArea.trail.join('\n')}\n` +
          `--- เนื้อหาหน้าสุดท้าย (800 ตัวอักษรแรก) ---\n` +
          (await page.locator('body').innerText().catch(() => '')).slice(0, 800)
      );
      expect.soft(
        uploadArea.found,
        `[PIPE-C] หน้า /dashboard และ /resumes/upload ไม่มี input ไฟล์ resume เลย — DOM จริงต่างจาก locator ` +
          '(ปรับจูนด้วย npx playwright codegen แล้วแนบ dump มาให้ปรับ locator) — ดูหลักฐาน PIPE-upload-area'
      );
      if (!uploadArea.found) return;

      /* ---------- PIPE-D: อัปโหลดไฟล์จริง ---------- */
      const uploadMode = await dashboard.uploadResume(resolved.file);
      await page.waitForTimeout(4_000);
      const bodyAfterUpload = await page.locator('body').innerText().catch(() => '');
      const fileName = path.basename(resolved.file);
      await attachEvidence(
        testInfo,
        `PIPE-upload-${member.email}`,
        `โหมดอัปโหลดที่หน้าจริงใช้: ${uploadMode} (auto = เลือกไฟล์แล้วระบบส่งเอง / explicit = กดปุ่มเอง)\n` +
          `เห็นชื่อไฟล์ "${fileName}" บนหน้า: ${bodyAfterUpload.includes(fileName)}\n` +
          `API calls จนถึงขั้นนี้:\n${tracker.calls.slice(-10).join('\n') || '(ไม่มี)'}\n` +
          `--- เนื้อหาหลังอัปโหลด (800 ตัวอักษรแรก) ---\n${bodyAfterUpload.slice(0, 800)}`
      );
      expect.soft(
        bodyAfterUpload.includes(fileName),
        `[PIPE-D] อัปโหลดส่งแล้วแต่ไม่พบชื่อไฟล์ "${fileName}" บนหน้า — ตรวจว่าระบบรับไฟล์จริงหรือแจ้ง error อื่น (ดู dump ที่แนบ)`
      );

      /* ---------- PIPE-E: เลือกตำแหน่ง (JOB_MATCH) ถ้าหน้าจริงรองรับ ---------- */
      const jobSelectPresent = (await dashboard.jobSelect.count()) > 0;
      let jobSelectEvidence = `หน้าจริงมีตัวเลือกตำแหน่งงาน: ${jobSelectPresent}`;
      if (jobSelectPresent) {
        const options = await dashboard.jobSelect.locator('option').allInnerTexts().catch(() => []);
        jobSelectEvidence += `\nchoices จริงบนหน้า: ${JSON.stringify(options)}`;
        await dashboard.selectJob(member.jobOption);
        const chosen = await dashboard.jobSelect
          .inputValue()
          .then((value) => value.trim().length > 0)
          .catch(() => false);
        jobSelectEvidence += `\nเลือก "${member.jobOption}" สำเร็จ: ${chosen}`;
        expect.soft(
          chosen,
          `[PIPE-E] เลือกตำแหน่ง "${member.jobOption}" ไม่สำเร็จ (choices จริงดูหลักฐาน) — ` +
            'ถ้า choices ไม่มีตำแหน่งนี้ = วิเคราะห์นี้เทียบ BASE แทน ผล JOB_MATCH ต้องดูจาก choices จริง'
        );
      } else {
        jobSelectEvidence +=
          '\nไม่พบ select — วิเคราะห์รอบนี้จึงเป็น BASE (ไม่เทียบตำแหน่ง) หรือหน้าจริงใช้ UI รูปแบบอื่น (ดู dump)';
      }
      await attachEvidence(testInfo, `PIPE-job-select-${member.email}`, jobSelectEvidence);

      /* ---------- PIPE-F: กดวิเคราะห์ + รอผลจนเสร็จจริง (สูงสุด 300 วิ) ---------- */
      const analyzeVisible = await dashboard.analyzeButton.isVisible().catch(() => false);
      await attachEvidence(
        testInfo,
        `PIPE-analyze-start-${member.email}`,
        `ปุ่มวิเคราะห์แสดง: ${analyzeVisible}\nURL ก่อนกด: ${page.url()}`
      );
      expect.soft(
        analyzeVisible,
        `[PIPE-F] ไม่พบปุ่มวิเคราะห์ (locator: button "วิเคราะห์/analyze") หลังอัปโหลด — ดู dump ที่แนบ`
      );
      if (!analyzeVisible) return;

      await dashboard.analyze();
      const poll = await pollAnalysis(page, 300_000);
      await attachEvidence(
        testInfo,
        `PIPE-poll-timeline-${member.email}`,
        `ผลการรอ: ${poll.outcome} (result-shown = เห็นคะแนน+เนื้อหาผล / failed-status = ระบบแจ้งล้มเหลว / timeout = รอครบ 300 วิ)\n` +
          `timeline สถานะที่เห็นจริง:\n${poll.timeline.join('\n') || '(สถานะไม่เปลี่ยนเลยตลอดการรอ)'}\n` +
          `API calls ระหว่าง pipeline:\n${tracker.calls.slice(-25).join('\n') || '(ไม่มี)'}`
      );
      await attachEvidence(
        testInfo,
        `PIPE-final-page-${member.email}`,
        `URL สุดท้าย: ${page.url()}\n--- เนื้อหาหน้าสุดท้ายเต็ม (2400 ตัวอักษรแรก) ---\n${poll.finalBody.slice(0, 2400)}`
      );

      expect.soft(
        poll.outcome !== 'failed-status',
        `[PIPE-F] ระบบแสดงสถานะวิเคราะห์ "ล้มเหลว" — หลักฐาน API calls + timeline อยู่ในไฟล์แนบ (รายงานตามจริง ไม่สรุปแทน backend)`
      );
      expect.soft(
        poll.outcome === 'result-shown',
        `[PIPE-G] ยืนยันผลวิเคราะห์สำเร็จไม่ได้ภายใน 300 วินาที (outcome=${poll.outcome}) — ` +
          'ตามกฎเฟรมเวิร์ก: ไม่มีหลักฐานผล = รายงาน BLOCKED ไม่ผ่าน (ดู timeline + API calls ที่แนบ)'
      );

      /* ---------- PIPE-H: ผลวิเคราะห์บนหน้า (คะแนน/จุดแข็ง/จุดปรับปรุง) ---------- */
      if (poll.outcome === 'result-shown') {
        const scoreLines = extractScoreLines(poll.finalBody);
        const hasStrengths = /จุดแข็ง|strength/i.test(poll.finalBody);
        const hasImprovements = /ปรับปรุง|improve/i.test(poll.finalBody);
        await attachEvidence(
          testInfo,
          `PIPE-result-content-${member.email}`,
          `บรรทัดที่มีตัวเลขคะแนนบนหน้าจริง:\n${scoreLines.join('\n') || '(ไม่พบบรรทัดแนวคะแนน)'}\n` +
            `มีส่วนจุดแข็ง: ${hasStrengths}\nมีส่วนจุดที่ควรปรับปรุง: ${hasImprovements}`
        );
        expect.soft(
          scoreLines.length > 0,
          `[PIPE-H] ผลวิเคราะห์แสดงแล้วแต่ไม่พบคะแนนตัวเลขบนหน้า (inventory §3.3 ระบุผลิตภัณฑ์มี Resume Score) — ดู PIPE-final-page`
        );
        expect.soft(
          hasStrengths || hasImprovements,
          `[PIPE-H] ไม่พบทั้งส่วนจุดแข็งและจุดที่ควรปรับปรุงในผลวิเคราะห์ — ดู PIPE-final-page`
        );
      }

      /* ---------- PIPE-I: ประวัติการวิเคราะห์ ---------- */
      const historyVisible = await dashboard.historyTable.isVisible().catch(() => false);
      const historyRowCount = historyVisible
        ? await dashboard.historyRows.count().catch(() => -1)
        : -1;
      const historyHasFile = historyVisible
        ? (await dashboard.historyTable.innerText().catch(() => '')).includes(fileName)
        : false;
      await attachEvidence(
        testInfo,
        `PIPE-history-${member.email}`,
        `ตารางประวัติแสดง: ${historyVisible}\nจำนวนแถว: ${historyRowCount}\nประวัติอ้างถึงไฟล์ที่เพิ่งอัปโหลด: ${historyHasFile}`
      );
      expect.soft(
        historyVisible && historyRowCount > 0,
        `[PIPE-I] ไม่พบประวัติการวิเคราะห์ (inventory §3.3 ระบุมี History) — ดู dump ที่แนบ`
      );

      tracker.stop();
    });
  }

  test('[TEAM-PIPE-REAL-4] Kanyarat — วิเคราะห์ BASE (ไม่เทียบตำแหน่ง) + /jobs สร้างตำแหน่งงานจริง', async ({ page }, testInfo) => {
    test.setTimeout(480_000);
    const member = TEAM_USERS[0];
    const tracker = trackPipelineApi(page);
    const dashboard = new DashboardPage(page);
    await loginMember(page, member);

    /* ---------- 4a: วิเคราะห์ BASE — ไม่เลือกตำแหน่ง ---------- */
    const uploadArea = await openUploadArea(page, dashboard);
    expect.soft(
      uploadArea.found,
      '[4a] ไม่พบ input ไฟล์ resume ทั้ง /dashboard และ /resumes/upload — ดู dump ที่แนบ'
    );
    if (!uploadArea.found) return;

    const resolved = findTeamResumeFile(member);
    expect.soft(resolved !== null, '[4a] ไม่พบไฟล์ resume ของ Kanyarat (ดูหลักฐานในเคส PIPE ของคนเดียวกัน)');
    if (!resolved) return;

    await dashboard.uploadResume(resolved.file);
    await page.waitForTimeout(3_000);
    await dashboard.analyze();
    const basePoll = await pollAnalysis(page, 300_000);
    await attachEvidence(
      testInfo,
      'PIPE-4-base-analysis',
      `ผลการรอวิเคราะห์ BASE: ${basePoll.outcome}\ntimeline:\n${basePoll.timeline.join('\n') || '(สถานะไม่เปลี่ยน)'}\n` +
        `--- เนื้อหาหน้าสุดท้าย (1200 ตัวอักษรแรก) ---\n${basePoll.finalBody.slice(0, 1200)}`
    );
    expect.soft(
      basePoll.outcome === 'result-shown',
      `[4a] วิเคราะห์ BASE ยืนยันผลสำเร็จไม่ได้ภายใน 300 วิ (outcome=${basePoll.outcome}) — ดูหลักฐาน PIPE-4-base-analysis`
    );

    /* ---------- 4b: /jobs — สร้างตำแหน่งงานของสายงาน (Job Descriptions CRUD) ---------- */
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    const jobsBodyBefore = await page.locator('body').innerText().catch(() => '');

    const titleInput = page
      .locator('#job-title, input[name*="title" i], input[placeholder*="ตำแหน่ง" i], input[placeholder*="title" i]')
      .first();
    const companyInput = page
      .locator('#job-company, input[name*="company" i], input[placeholder*="บริษัท" i]')
      .first();
    const titleFound = await titleInput.isVisible().catch(() => false);
    const companyFound = await companyInput.isVisible().catch(() => false);

    await attachEvidence(
      testInfo,
      'PIPE-4-jobs-form',
      `หน้า /jobs — URL: ${page.url()}\nพบช่อง title: ${titleFound} | พบช่อง company: ${companyFound}\n` +
        `--- เนื้อหาหน้า /jobs ก่อนสร้าง (800 ตัวอักษรแรก) ---\n${jobsBodyBefore.slice(0, 800)}`
    );

    if (!titleFound) {
      await attachEvidence(
        testInfo,
        'PIPE-4-jobs-dump',
        'ไม่พบฟอร์มสร้างตำแหน่งงานด้วย locator มาตรฐาน — ดูองค์ประกอบจริงด้านล่าง\n' +
          (await page.locator('body').innerText().catch(() => '')).slice(0, 1200)
      );
      expect.soft(
        false,
        '[4b] หน้า /jobs จริงไม่พบฟอร์มสร้างตำแหน่งงาน (locator #job-title / input[name*=title] / placeholder ตำแหน่ง) — ' +
          'ถ้าระบบใช้ UI รูปแบบอื่น ให้ npx playwright codegen <BASE_URL>/jobs แล้วส่ง dump มาปรับ locator'
      );
      tracker.stop();
      return;
    }

    await titleInput.fill(member.jobToCreate.title);
    if (companyFound) await companyInput.fill(member.jobToCreate.company);

    const submitButton = page
      .locator(
        '#job-form button[type="submit"], form button[type="submit"], ' +
          'button:has-text("เพิ่ม"), button:has-text("บันทึก"), button:has-text("สร้าง"), button:has-text("Create")'
      )
      .first();
    const submitVisible = await submitButton.isVisible().catch(() => false);
    expect.soft(
      submitVisible,
      '[4b] พบฟอร์มตำแหน่งงานแต่ไม่พบปุ่มส่ง (submit/เพิ่ม/บันทึก/สร้าง) — ดู dump ที่แนบ'
    );
    if (!submitVisible) {
      tracker.stop();
      return;
    }

    await submitButton.click();
    await page.waitForTimeout(4_000);
    const jobsBodyAfter = await page.locator('body').innerText().catch(() => '');
    const createdShown = jobsBodyAfter.includes(member.jobToCreate.title);
    await attachEvidence(
      testInfo,
      'PIPE-4-jobs-created',
      `กดสร้างตำแหน่ง "${member.jobToCreate.title}" (company: ${member.jobToCreate.company})\n` +
        `ตำแหน่งปรากฏบนหน้าหลังสร้าง: ${createdShown}\n` +
        `--- เนื้อหาหน้า /jobs หลังสร้าง (1200 ตัวอักษรแรก) ---\n${jobsBodyAfter.slice(0, 1200)}`
    );
    expect.soft(
      createdShown,
      `[4b] สร้างตำแหน่งแล้วแต่ "${member.jobToCreate.title}" ไม่ปรากฏบนหน้า — ` +
        'ฟังก์ชัน Job Descriptions อาจบันทึกไม่สำเร็จหรือรายการต้อง refresh (ดู dump หลังสร้าง)'
    );
    tracker.stop();
  });

  test('[TEAM-PIPE-REAL-5] Kanyarat — ฟังก์ชันเสริมให้ครบ: /resumes/upload โดยตรง + ไฟล์ผิดชนิดต้องถูกปฏิเสธ + /privacy', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const member = TEAM_USERS[0];
    const tracker = trackPipelineApi(page);
    await loginMember(page, member);

    /* ---------- 5a: /resumes/upload เข้าตรง ๆ ขณะล็อกอิน (inventory §2 = UNVERIFIED) ---------- */
    await page.goto('/resumes/upload', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    const uploadRouteBody = await page.locator('body').innerText().catch(() => '');
    const uploadRouteHasInput = await page
      .locator('input[type="file"]')
      .first()
      .isVisible()
      .catch(() => false);
    await attachEvidence(
      testInfo,
      'PIPE-5-upload-route',
      `เข้า /resumes/upload โดยตรง — URL สุดท้าย: ${page.url()}\nมี input ไฟล์: ${uploadRouteHasInput}\n` +
        `--- เนื้อหาหน้า (600 ตัวอักษรแรก) ---\n${uploadRouteBody.slice(0, 600)}`
    );

    /* ---------- 5b: อัปโหลดไฟล์ผิดชนิด — ระบบควรปฏิเสธ (validation) ---------- */
    const fakePdfPath = path.join(FIXTURE_FILES_DIR, 'not-a-real-cv.pdf');
    if (fs.existsSync(fakePdfPath) && uploadRouteHasInput) {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(fakePdfPath);
      await page.waitForTimeout(4_000);
      const bodyAfterInvalid = await page.locator('body').innerText().catch(() => '');
      const rejected =
        /ผิด|ไม่ถูก|ไม่รองรับ|pdf เท่านั้น|invalid|not (a |supported)|failed|ล้มเหลว/i.test(bodyAfterInvalid);
      await attachEvidence(
        testInfo,
        'PIPE-5-invalid-file',
        `อัปโหลดไฟล์ "not-a-real-cv.pdf" (นามสกุล .pdf แต่เนื้อหาไม่ใช่ PDF)\n` +
          `ระบบปฏิเสธ/แจ้งเตือน: ${rejected}\n` +
          `--- เนื้อหาหลังอัปโหลดไฟล์ผิดชนิด (800 ตัวอักษรแรก) ---\n${bodyAfterInvalid.slice(0, 800)}`
      );
      expect.soft(
        rejected,
        '[5b] ไฟล์ที่ไม่ใช่ PDF จริงถูกยอมรับโดยไม่มีข้อความเตือน = validation ฝั่งหน้า/หลังบ้านอ่อนแอ (หลักฐาน PIPE-5-invalid-file — รายงานเป็นข้อสังเกต ไม่สรุปแทน backend)'
      );
    } else {
      await attachEvidence(
        testInfo,
        'PIPE-5-invalid-file',
        `ข้าม: ${!fs.existsSync(fakePdfPath) ? 'ไม่มีไฟล์ fixtures/files/not-a-real-cv.pdf (รัน npm run gen:fixtures ก่อน)' : 'หน้า /resumes/upload ไม่มี input ไฟล์'}`
      );
    }

    /* ---------- 5c: /privacy — ลิงก์ที่หน้า login อ้างถึง (inventory §2 = ต้องตรวจซ้ำ) ---------- */
    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    const privacyBody = await page.locator('body').innerText().catch(() => '');
    await attachEvidence(
      testInfo,
      'PIPE-5-privacy',
      `เข้า /privacy — URL สุดท้าย: ${page.url()}\n` +
        `--- เนื้อหาหน้า (600 ตัวอักษรแรก) ---\n${privacyBody.slice(0, 600)}`
    );

    /* ---------- 5d: หลักฐาน API รวมของเคสนี้ ---------- */
    await attachEvidence(
      testInfo,
      'PIPE-5-api-calls',
      `/api/** ที่ถูกยิงระหว่างเคสนี้:\n${tracker.calls.slice(-20).join('\n') || '(ไม่มี)'}`
    );
    tracker.stop();
  });
});