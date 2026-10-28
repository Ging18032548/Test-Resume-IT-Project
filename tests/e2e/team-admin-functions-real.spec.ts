import { test, expect } from '../../fixtures/test-fixtures';
import type { Page } from '@playwright/test';
import { APP } from '../../config/config';
import { TEAM_USERS, hasTeamCredentials } from '../../fixtures/test-data';
import { LoginPage } from '../../pages/LoginPage';
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';

/**
 * ============================================================
 * TEAM-ADMF-REAL — ฟังก์ชันหน้าผู้ดูแลระบบ (/admin) บน learnace.tech จริง
 * (MOCK_API=false + บัญชีทีมจาก .env เท่านั้น — เงื่อนไขไม่ครบ = BLOCKED ตามกฎเฟรมเวิร์ก)
 * ============================================================
 * โครงสร้างที่ยืนยันจากการเข้า /admin จริง (docs/website-inventory.md §3.4):
 *   เมนู: System Overview / Services / Data / Users / Analysis / Audit log / Session
 *   - System Overview: สถิติ, Success Rate, เวลาเฉลี่ย, ตาราง trend, ช่วง 7/30 วัน
 *   - Service Status: auto-refresh 15 วิ, Queue Analysis (BullMQ)
 *   - Users: ค้นหา / ปลดล็อก / จัดการสิทธิ์ — ตาราง User/Role/Registered/Last Login
 *   - Analysis: กรองสถานะ (All/In progress/Success/Failed), Retry failed, Cancel pending
 *   - Audit log: Time / Operator / Action / Target / Details / IP
 *
 * ครอบคลุมฟังก์ชัน:
 *   1) /admin เมื่อยังไม่ล็อกอิน → ต้องถูก gate (access control)
 *   2) เมนูแท็บครบ 7 รายการ + เปิดได้จริง + dump องค์ประกอบทุกแท็บ
 *   3) System Overview: สถิติแสดง + ตาราง trend + สลับช่วง 7/30 วัน
 *   4) Users: ค้นหาด้วยอีเมลทีม → ผลลัพธ์ต้องยังเห็นตัวตนของทีม
 *   5) Analysis + Audit log: แท็บตอบสนอง + กรองสถานะ + หลักฐาน /api/admin/** ทุก call
 *   6) Logout จาก /admin → กลับหน้า sign-in → /admin ถูก gate ซ้ำ
 *
 * บัญชีตัวแทน = Kanyarat (TEAM-SIGNIN-REAL พิสูจน์แล้วว่า 3 คนเข้า /admin ได้ครบ —
 * ชุดนี้ทดสอบ "ฟังก์ชันของหน้า" ด้วย 1 บัญชีตัวแทน เพื่อไม่ยิง production ซ้ำเกินจำเป็น)
 */

const PRIMARY = TEAM_USERS[0]; // Kanyarat Patthanan — บัญชีตัวแทน

test.describe('TEAM-ADMF-REAL — ฟังก์ชันหน้า /admin บน learnace.tech (MOCK_API=false)', () => {
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

  /** เข้าสู่ระบบด้วยบัญชีตัวแทน — throw ถ้า login ไม่ผ่าน (รากปัญหาให้ดูชุด TEAM-SIGNIN-REAL ก่อน) */
  async function loginPrimary(page: Page): Promise<void> {
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(PRIMARY.email, PRIMARY.password);
    await login.expectLoginSuccess();
  }

  /** เปิดหน้า /admin หลังล็อกอิน แล้วรอ SPA render + ยิง API */
  async function openAdminAfterLogin(page: Page): Promise<void> {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6_000);
  }

  /** ติดตามทุก response ของ /api/admin/** เป็นหลักฐานระดับเครือข่าย (url + status ทุก call) */
  function trackAdminApi(page: Page): { calls: string[]; stop(): void } {
    const calls: string[] = [];
    const handler = (response: { url(): string; status(): number }): void => {
      if (response.url().includes('/api/admin/')) {
        calls.push(`${response.status()} ${response.url()}`);
      }
    };
    page.on('response', handler);
    return { calls, stop: () => page.off('response', handler) };
  }

  /** เปิด /admin โดยยังไม่ล็อกอิน แล้วตัดสินว่าถูก gate หรือไม่ (เช็คทั้ง URL และฟอร์มบนหน้า) */
  async function adminGateStatus(page: Page): Promise<{ gated: boolean; url: string; gateFormShown: boolean }> {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3_000);
    const url = page.url();
    const gateFormShown = await page
      .locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]')
      .first()
      .isVisible()
      .catch(() => false);
    return { gated: /sign-in|login/i.test(url) || gateFormShown, url, gateFormShown };
  }

  test('[TEAM-ADMF-REAL-1] /admin เมื่อยังไม่ล็อกอิน → ต้องถูก gate (ไม่โชว์ข้อมูล admin)', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const status = await adminGateStatus(page);
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);

    await attachEvidence(
      testInfo,
      'ADMF-1-gate-logged-out',
      `URL สุดท้าย: ${status.url}\nฟอร์มเข้าสู่ระบบแสดง: ${status.gateFormShown}\n` +
        `--- เนื้อหาหน้า (800 ตัวอักษรแรก) ---\n${bodyText}`
    );

    // หมายเหตุ BUG-003 (จากการสำรวจ): หน้า /admin ตอนไม่ล็อกอินเคยแสดง "โครงสร้างเมนู" ร่วมกับฟอร์ม —
    // สิ่งที่ยอมรับไม่ได้คือ "ข้อมูล admin จริง" (สถิติ/ตาราง user) แสดงโดยไม่ยืนยันตัวตน
    expect.soft(
      status.gated,
      '[ADMF-1] เข้า /admin โดยไม่ล็อกอิน ต้องเจอฟอร์มเข้าสู่ระบบหรือถูกพาไป /sign-in — ' +
        'ถ้าไม่ใช่ = ช่องโหว่ access control (ดู dump ที่แนบ)'
    );
  });

  test('[TEAM-ADMF-REAL-2] เมนูแท็บครบตามโครงสร้างจริง (Overview/Services/Data/Users/Analysis/Audit/Session)', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await loginPrimary(page);
    const tracker = trackAdminApi(page);
    const admin = new AdminDashboardPage(page);
    await openAdminAfterLogin(page);

    const dumpBefore = await admin.interactiveElementsDump();
    await attachEvidence(
      testInfo,
      'ADMF-2-dump-elements',
      `URL: ${page.url()}\n--- องค์ประกอบเชิงโต้ตอบทั้งหน้า (จาก DOM จริง) ---\n${dumpBefore}`
    );

    const EXPECTED_TABS = [
      'System Overview',
      'Services',
      'Data',
      'Users',
      'Analysis',
      'Audit log',
      'Session',
    ];
    const found: string[] = [];
    const missing: string[] = [];
    for (const tabLabel of EXPECTED_TABS) {
      const opened = await admin.openAdminTab(tabLabel);
      if (opened) {
        found.push(tabLabel);
        const tabBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
        await attachEvidence(
          testInfo,
          `ADMF-2-tab-${tabLabel.toLowerCase().replace(/\s+/g, '-')}`,
          `เปิดแท็บ "${tabLabel}" สำเร็จ — URL: ${page.url()}\n--- เนื้อหาหลังเปิด (400 ตัวอักษรแรก) ---\n${tabBody}`
        );
      } else {
        missing.push(tabLabel);
      }
    }

    await attachEvidence(
      testInfo,
      'ADMF-2-tab-summary',
      `พบและเปิดได้: ${found.length > 0 ? found.join(', ') : '(ไม่มีเลย)'}\n` +
        `หาไม่เจอบน DOM จริง: ${missing.length > 0 ? missing.join(', ') : '(เปิดได้ครบทุกแท็บ)'}\n` +
        `/api/admin/** ที่ถูกยิงระหว่างเปิดแท็บ:\n${tracker.calls.slice(-20).join('\n') || '(ไม่มี)'}` +
        `\n--- วินิจฉัยถ้ามีแท็บหาย: ดู ADMF-2-dump-elements ว่าเมนูจริงใช้ชื่อ/ภาษาอื่นหรือซ่อนอยู่ (ปรับจูนด้วย npx playwright codegen) ---`
    );
    tracker.stop();

    expect.soft(
      found.length > 0,
      '[ADMF-2] ต้องพบแท็บ admin อย่างน้อย 1 แท็บจากโครงสร้างที่ยืนยันไว้ — ถ้า 0 = หน้า /admin ไม่ใช่หน้า admin จริง (ดู dump)'
    );
    expect.soft(
      missing.length === 0,
      `[ADMF-2] ไม่พบแท็บ: ${missing.join(', ')} — เมนูจริงอาจใช้ชื่อ/ภาษาอื่นหรือต้อง scroll (โครงสร้างยืนยันไว้: ${EXPECTED_TABS.join(' / ')})`
    );
  });

  test('[TEAM-ADMF-REAL-3] System Overview — สถิติแสดง + ตาราง trend + สลับช่วง 7/30 วัน', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await loginPrimary(page);
    const tracker = trackAdminApi(page);
    const admin = new AdminDashboardPage(page);
    await openAdminAfterLogin(page);

    // แท็บ Overview มักเป็นค่าเริ่มต้น — ถ้าไม่ใช่ กดเปิดเอง
    await admin.openAdminTab('System Overview');
    await page.waitForTimeout(2_000);

    const bodyText = await page.locator('body').innerText().catch(() => '');
    const hasOverviewWords = /overview|ภาพรวม|success rate|อัตรา|แนวโน้ม|trend|สถิติ/i.test(bodyText);
    const tableVisible = await admin.trendTable.isVisible().catch(() => false);
    const tableRows = tableVisible
      ? await admin.trendTable.locator('tbody tr').count().catch(() => -1)
      : -1;

    await attachEvidence(
      testInfo,
      'ADMF-3-overview',
      `URL: ${page.url()}\n` +
        `พบคำสถิติ/Overview: ${hasOverviewWords}\n` +
        `ตาราง (trend) แสดง: ${tableVisible} | จำนวนแถว: ${tableRows}\n` +
        `--- เนื้อหาหน้า (1000 ตัวอักษรแรก) ---\n${bodyText.slice(0, 1000)}`
    );

    expect.soft(
      hasOverviewWords,
      '[ADMF-3] หน้า System Overview ต้องมีเนื้อหาสถิติ (คำว่า overview/ภาพรวม/success rate/trend) — ดู dump ที่แนบ'
    );

    /* ---------- สลับช่วงเวลา 7/30 วัน (ฟังก์ชันเลือกช่วงของกราฟ trend) ---------- */
    const has30Days = await admin.period30DaysButton.isVisible().catch(() => false);
    const has7Days = await admin.period7DaysButton.isVisible().catch(() => false);
    if (has30Days && has7Days) {
      const bodyBefore = (await page.locator('body').innerText().catch(() => '')).length;
      await admin.period30DaysButton.click();
      await page.waitForTimeout(3_000);
      const bodyAfter30 = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
      await admin.period7DaysButton.click();
      await page.waitForTimeout(3_000);
      const bodyAfter7 = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);

      await attachEvidence(
        testInfo,
        'ADMF-3-period-toggle',
        `ปุ่มสลับช่วง 7/30 วันมีจริงและคลิกได้\n` +
          `ความยาวเนื้อหาก่อนสลับ: ${bodyBefore} ตัวอักษร\n` +
          `--- เนื้อหาหลังเลือก 30 วัน ---\n${bodyAfter30}\n--- เนื้อหาหลังเลือก 7 วัน ---\n${bodyAfter7}`
      );
    } else {
      await attachEvidence(
        testInfo,
        'ADMF-3-period-toggle',
        `ไม่พบปุ่มสลับช่วง 7/30 วันบน DOM จริง (30 วัน: ${has30Days}, 7 วัน: ${has7Days}) — ` +
          'โครงสร้างที่สำรวจไว้ระบุว่ามีตัวเลือกช่วงเวลา ตรวจ dump หน้าว่าใช้รูปแบบอื่น (dropdown/segment) หรือไม่'
      );
    }

    expect.soft(
      tableVisible || hasOverviewWords,
      '[ADMF-3] System Overview ต้องมีตาราง trend หรือเนื้อหาสถิติแสดงจริง — ดูหลักฐาน ADMF-3-overview'
    );
    tracker.stop();
  });

  test('[TEAM-ADMF-REAL-4] Users — ค้นหาด้วยอีเมลทีม → ผลลัพธ์ต้องยังเห็นตัวตนของทีม', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await loginPrimary(page);
    const tracker = trackAdminApi(page);
    const admin = new AdminDashboardPage(page);
    await openAdminAfterLogin(page);

    await admin.openAdminTab('Users');
    await page.waitForTimeout(2_000);

    const bodyBefore = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    await attachEvidence(
      testInfo,
      'ADMF-4-users-before-search',
      `แท็บ Users (ก่อนค้นหา) — URL: ${page.url()}\n--- เนื้อหา (800 ตัวอักษรแรก) ---\n${bodyBefore}`
    );

    const searchVisible = await admin.userSearchInput.isVisible().catch(() => false);
    if (!searchVisible) {
      const dump = await admin.interactiveElementsDump();
      await attachEvidence(
        testInfo,
        'ADMF-4-search-not-found',
        `ไม่พบช่องค้นหาผู้ใช้บน DOM จริง (locator: input[type=search]/placeholder ค้นหา/search)\n` +
          `--- องค์ประกอบทั้งหน้า ---\n${dump}`
      );
      expect.soft(
        false,
        '[ADMF-4] ฟังก์ชันค้นหาผู้ใช้: ไม่พบช่องค้นหาบนหน้า Users จริง — ดู dump องค์ประกอบที่แนบ (โครงสร้างที่สำรวจไว้ระบุว่ามีฟังก์ชันค้นหา)'
      );
      tracker.stop();
      return;
    }

    /* ---------- ค้นหาด้วย username ของอีเมลทีม (คำค้นที่ "แน่ใจว่าต้องเจอ") ---------- */
    const keyword = PRIMARY.email.split('@')[0]; // "kanyarat.p.hr"
    await admin.searchUser(keyword);
    await page.waitForTimeout(3_000);

    const bodyAfterSearch = await page.locator('body').innerText().catch(() => '');
    const identityStillShown =
      bodyAfterSearch.includes(PRIMARY.email) || bodyAfterSearch.includes(PRIMARY.displayName);
    const searchValueKept = await admin.userSearchInput
      .inputValue()
      .then((value) => value.trim().length > 0)
      .catch(() => false);

    await attachEvidence(
      testInfo,
      `ADMF-4-users-after-search-${keyword}`,
      `คำค้นหา: "${keyword}" (username ของ ${PRIMARY.email})\n` +
        `ค่าในช่องค้นหาหลัง Enter: ${searchValueKept ? 'ถูกบันทึก' : 'ถูกล้าง/อ่านไม่ได้'}\n` +
        `ยังเห็นตัวตนทีม (ชื่อ/อีเมล) หลังค้นหา: ${identityStillShown}\n` +
        `--- เนื้อหาหลังค้นหา (1000 ตัวอักษรแรก) ---\n${bodyAfterSearch.slice(0, 1000)}\n` +
        `/api/admin/** ที่ถูกยิง:\n${tracker.calls.slice(-15).join('\n') || '(ไม่มี)'}`
    );
    tracker.stop();

    expect.soft(
      identityStillShown,
      `[ADMF-4] ค้นหา "${keyword}" แล้วต้องยังเห็นตัวตนของทีมในผลลัพธ์ (ตาราง Users ต้องตอบสนองการค้นหา) — ` +
        'ถ้าหาย = ฟังก์ชันค้นหาบั๊กหรือค้นหาที่ backend ไม่ทำงาน (ดูหลักฐาน ADMF-4)'
    );
  });

  test('[TEAM-ADMF-REAL-5] Analysis + Audit log — แท็บตอบสนอง + กรองสถานะได้ + หลักฐาน /api/admin/**', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await loginPrimary(page);
    const tracker = trackAdminApi(page);
    const admin = new AdminDashboardPage(page);
    await openAdminAfterLogin(page);

    /* ---------- แท็บ Analysis + กรองสถานะ ---------- */
    const analysisOpened = await admin.openAdminTab('Analysis');
    await page.waitForTimeout(2_000);
    const analysisBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    const hasAnalysisWords = /analysis|สถานะ|status|score|คะแนน|progress|success|failed/i.test(analysisBody);

    await attachEvidence(
      testInfo,
      'ADMF-5-analysis-tab',
      `เปิดแท็บ Analysis: ${analysisOpened} — URL: ${page.url()}\n` +
        `พบคำเกี่ยวกับการวิเคราะห์/สถานะ: ${hasAnalysisWords}\n--- เนื้อหา (800 ตัวอักษรแรก) ---\n${analysisBody}`
    );

    // กรองสถานะ (โครงสร้างยืนยันไว้: All / In progress / Success / Failed)
    let filterUsed = false;
    if (analysisOpened) {
      try {
        await admin.filterAnalysisByStatus('Success');
        await page.waitForTimeout(2_000);
        filterUsed = true;
        const bodyAfterFilter = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
        await attachEvidence(
          testInfo,
          'ADMF-5-analysis-filter',
          `เลือกตัวกรอง "Success" สำเร็จ — URL: ${page.url()}\n--- เนื้อหาหลังกรอง ---\n${bodyAfterFilter}`
        );
      } catch (error) {
        await attachEvidence(
          testInfo,
          'ADMF-5-analysis-filter',
          `ใช้ตัวกรองสถานะไม่สำเร็จ: ${String(error).slice(0, 200)} — ตัวกรองอาจเป็นปุ่ม/เมนูรูปแบบอื่น (ดู dump แท็บ Analysis)`
        );
      }
    }

    /* ---------- แท็บ Audit log ---------- */
    const auditOpened = await admin.openAdminTab('Audit log');
    await page.waitForTimeout(2_000);
    const auditBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    const hasAuditWords = /audit|operator|action|target|details|ip|บันทึก|เหตุการณ์/i.test(auditBody);

    await attachEvidence(
      testInfo,
      'ADMF-5-audit-tab',
      `เปิดแท็บ Audit log: ${auditOpened} — URL: ${page.url()}\n` +
        `พบคำเกี่ยวกับ audit (operator/action/ip): ${hasAuditWords}\n--- เนื้อหา (800 ตัวอักษรแรก) ---\n${auditBody}`
    );

    await attachEvidence(
      testInfo,
      'ADMF-5-admin-api-calls',
      `/api/admin/** ทั้งหมดที่ถูกยิงระหว่างเทสต์นี้ (หลักฐานระดับเครือข่าย):\n${tracker.calls.slice(-25).join('\n') || '(ไม่มี)'}`
    );
    tracker.stop();

    expect.soft(
      hasAnalysisWords,
      '[ADMF-5] แท็บ Analysis ต้องแสดงเนื้อหาการวิเคราะห์ (สถานะ/คะแนน) — ดู dump ที่แนบ'
    );
    expect.soft(
      hasAuditWords,
      '[ADMF-5] แท็บ Audit log ต้องแสดงตารางบันทึกเหตุการณ์ (operator/action/ip) — ดู dump ที่แนบ'
    );
  });

  test('[TEAM-ADMF-REAL-6] Logout จากหน้า /admin → กลับหน้า sign-in → /admin ถูก gate ซ้ำ', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await loginPrimary(page);
    const admin = new AdminDashboardPage(page);
    await openAdminAfterLogin(page);

    const dump = await admin.interactiveElementsDump();
    const loggedOut = await admin.logoutIfPresent();

    await attachEvidence(
      testInfo,
      'ADMF-6-logout-attempt',
      `พยายาม logout: ${loggedOut ? 'กดปุ่มออกจากระบบสำเร็จ' : 'หาปุ่ม logout ไม่เจอ'}\nURL ปัจจุบัน: ${page.url()}\n` +
        (loggedOut ? '' : `--- องค์ประกอบทั้งหน้า (หาปุ่ม logout) ---\n${dump}`)
    );

    expect.soft(
      loggedOut,
      '[ADMF-6] ต้องพบปุ่มออกจากระบบบนหน้า /admin (รองรับแล้วทั้ง dropdown ผู้ใช้และ hamburger) — ถ้าไม่มี = ฟังก์ชัน logout ขาดหายจากหน้า admin'
    );
    if (!loggedOut) return;

    await page.waitForTimeout(2_000);
    const backAtSignIn =
      /sign-in|login/i.test(page.url()) ||
      (await page
        .locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]')
        .first()
        .isVisible()
        .catch(() => false));

    await attachEvidence(
      testInfo,
      'ADMF-6-after-logout',
      `หลัง logout — URL: ${page.url()}\nกลับมาหน้าเข้าสู่ระบบ: ${backAtSignIn}`
    );
    expect.soft(
      backAtSignIn,
      `[ADMF-6] หลังออกจากระบบต้องกลับมาหน้าเข้าสู่ระบบ — URL จริง: ${page.url()}`
    );

    /* ---------- /admin ต้องถูก gate ซ้ำหลัง logout (สิทธิ์สูงสุด ห้ามตกค้าง) ---------- */
    const gateAgain = await adminGateStatus(page);
    await attachEvidence(
      testInfo,
      'ADMF-6-admin-gated-after-logout',
      `เข้า /admin ซ้ำหลัง logout — URL: ${gateAgain.url}\nถูก gate: ${gateAgain.gated}`
    );
    expect.soft(
      gateAgain.gated,
      '[ADMF-6] หลัง logout เข้า /admin ต้องถูก gate อีกครั้ง — ถ้ายังเห็นข้อมูล admin = ช่องโหว่ access control ร้ายแรง'
    );
  });
});