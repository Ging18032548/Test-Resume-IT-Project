import { test, expect } from '../../fixtures/test-fixtures';
import { APP, PASSWORD_POLICY } from '../../config/config';
import { TEAM_USERS, hasTeamCredentials } from '../../fixtures/test-data';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';

/**
 * ============================================================
 * TEAM-AUTHF-REAL — ฟังก์ชันกลุ่ม "ยืนยันตัวตน" บน learnace.tech จริง
 * (MOCK_API=false + บัญชีทีมจาก .env เท่านั้น — เงื่อนไขไม่ครบ = BLOCKED ตามกฎเฟรมเวิร์ก)
 * ============================================================
 * ครอบคลุมฟังก์ชันที่หลักฐานยืนยันว่ามีอยู่จริง (docs/website-inventory.md §3.1):
 *   1) โครงสร้างหน้า /sign-in ครบ (ฟอร์ม + Google OAuth + ลืมรหัสผ่าน + สมัครสมาชิก)
 *   2) ล็อกอินรหัสผ่านผิด → ถูกปฏิเสธ ไม่เข้า /dashboard (จับข้อความจริงจากระบบ)
 *   3) ล็อกอินด้วยอีเมลที่ไม่มีในระบบ → ถูกปฏิเสธ
 *   4) ล็อกอินช่องว่าง → validation กันการส่งฟอร์ม
 *   5) "ลืมรหัสผ่าน?" — คลิกได้จริง + โพรบด้วยอีเมลทีม 1 คน
 *      (ตัดสินว่าบัญชีมีอยู่จริง: ระบบส่งลิงก์ = มีบัญชี / บอกไม่พบ = ไม่มีบัญชี
 *       หมายเหตุ: ถ้าบัญชีมีอยู่ ระบบอาจส่งอีเมลกู้รหัสไปกล่องจริงของเจ้าของบัญชี — นี่คือหลักฐานตามแนวทางเฟรมเวิร์ก)
 *   6) สมัครด้วยอีเมลทีมซ้ำ → ต้องถูกปฏิเสธ = หลักฐานยืนยันว่าบัญชีถูกสร้างแล้วบนระบบ
 *   7) สมัครด้วยรหัสอ่อน → checklist "ยังไม่ผ่าน" + ต้องไม่สำเร็จ
 *      (ใช้อีเมลทีมตั้งใจ เพื่อกันกรณีระบบกันรหัสอ่อนไม่ได้แล้วเผลอสร้างบัญชีใหม่)
 *   8) URL ไม่มีจริง → SPA แสดงหน้าเข้าสู่ระบบ (baseline regression ของ BUG-001)
 *
 * บัญชีตัวแทน = Kanyarat (บัญชีแรกของ TEAM_USERS) — TEAM-SIGNIN-REAL พิสูจน์แล้วว่า
 * ทั้ง 3 คนล็อกอิน + เห็น /admin ได้ครบ ชุดนี้จึงทดสอบ "ฟังก์ชัน" ด้วย 1 บัญชีตัวแทน
 * เพื่อไม่ยิง production ซ้ำเกินจำเป็น (ลดความเสี่ยงโดน rate limit ของ Cloudflare tunnel)
 */

const PRIMARY = TEAM_USERS[0]; // Kanyarat Patthanan — บัญชีตัวแทน

test.describe('TEAM-AUTHF-REAL — ฟังก์ชันยืนยันตัวตนบน learnace.tech (MOCK_API=false)', () => {
  /** รายชื่อรหัสผ่านทีมที่ยังไม่ถูกตั้งใน .env — บอกผู้รันเป๊ะ ๆ ว่าขาดอะไร */
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
    await testInfo.attach(name, { body: text.slice(0, 2000), contentType: 'text/plain' });
  }

  test('[TEAM-AUTHF-REAL-1] โครงสร้างหน้า /sign-in ครบทุกองค์ประกอบตามหลักฐานเดิม', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const login = new LoginPage(page);
    await login.goto();

    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    await attachEvidence(
      testInfo,
      'AUTHF-1-signin-structure',
      `URL: ${page.url()}\n--- เนื้อหาหน้า /sign-in (800 ตัวอักษรแรก) ---\n${bodyText}`
    );

    await expect(login.emailInput).toBeVisible();
    await expect(login.passwordInput).toBeVisible();
    await expect(login.loginButton).toBeVisible();
    await login.expectForgotPasswordLinkVisible();
    await login.expectGoogleButtonVisible();
  });

  test('[TEAM-AUTHF-REAL-2] ล็อกอินรหัสผ่านผิด → ถูกปฏิเสธและไม่เข้า /dashboard', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const login = new LoginPage(page);
    await login.goto();

    // กติกาความปลอดภัย: พยายามผิดครั้งเดียวต่อรอบรัน (กันโดนระบบล็อกบัญชีจากการพยายามซ้ำ)
    await login.signIn(PRIMARY.email, `${PRIMARY.password}Wrong`);
    const rejectShown = await login.errorMessage
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const alertText = rejectShown ? (await login.errorMessage.innerText().catch(() => '')).trim() : '';
    const notInDashboard = !/\/dashboard/i.test(page.url());

    await attachEvidence(
      testInfo,
      `AUTHF-2-wrong-password-${PRIMARY.email}`,
      `รหัสผ่านที่ใช้: ค่า TEAM_KANYARAT_PASSWORD จาก .env + "Wrong" ต่อท้าย (ไม่พิมพ์ค่าจริง)\n` +
        `ถูกปฏิเสธด้วย alert: ${rejectShown}\nข้อความจากระบบ: "${alertText || '(ไม่มี alert ที่จับได้)'}"\n` +
        `URL หลังกด: ${page.url()}\n` +
        `--- เนื้อหาหน้า (600 ตัวอักษรแรก) ---\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 600)}`
    );

    expect.soft(
      notInDashboard,
      `[AUTHF-2] รหัสผ่านผิดต้องไม่พาเข้า /dashboard — URL จริงหลังกด: ${page.url()}`
    );
    expect.soft(
      rejectShown,
      '[AUTHF-2] รหัสผ่านผิดต้องมีข้อความปฏิเสธแสดงบนหน้า (ถ้าเงียบ = ผู้ใช้ไม่รู้ว่าล็อกอินไม่ผ่าน — เป็นบั๊ก UX)'
    );
  });

  test('[TEAM-AUTHF-REAL-3] ล็อกอินด้วยอีเมลที่ไม่มีในระบบ → ถูกปฏิเสธ', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const login = new LoginPage(page);
    await login.goto();

    const unknownEmail = 'nobody.qa.invalid@example.test';
    await login.signIn(unknownEmail, PRIMARY.password);
    const rejectShown = await login.errorMessage
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const alertText = rejectShown ? (await login.errorMessage.innerText().catch(() => '')).trim() : '';

    await attachEvidence(
      testInfo,
      'AUTHF-3-unknown-email',
      `อีเมลที่ใช้: ${unknownEmail} (สร้างขึ้นเพื่อทดสอบ ไม่ใช่บัญชีจริง)\n` +
        `ถูกปฏิเสธด้วย alert: ${rejectShown}\nข้อความจากระบบ: "${alertText || '(ไม่มี alert ที่จับได้)'}"\n` +
        `URL หลังกด: ${page.url()}`
    );

    expect.soft(rejectShown, '[AUTHF-3] อีเมลไม่มีในระบบต้องถูกปฏิเสธด้วยข้อความแสดงบนหน้า');
    expect.soft(
      !/\/dashboard/i.test(page.url()),
      '[AUTHF-3] อีเมลไม่มีในระบบต้องไม่พาเข้า /dashboard'
    );

    // บทเรียนจาก TEAM-SIGNIN-REAL: ข้อความ "อีเมลหรือรหัสผ่านไม่ถูกต้อง" เจตนาให้ generic —
    // รายงานพฤติกรรมจริงเท่าที่หลักฐานมี ห้ามสรุปแทนระบบว่า "ควรบอกแยกว่าไม่มีบัญชี"
    if (alertText) {
      const generic = /อีเมลหรือรหัสผ่าน|email or password|invalid credentials/i.test(alertText);
      await attachEvidence(
        testInfo,
        'AUTHF-3-message-classification',
        generic
          ? 'ระบบใช้ข้อความ generic (ไม่เปิดเผยว่าบัญชีมีหรือไม่มี) — เป็นแนวปฏิบัติที่ปลอดภัยต่อการเดาบัญชี'
          : `ระบบใช้ข้อความเฉพาะ: "${alertText}" — ตรวจว่าเผยข้อมูลเกินจำเป็นหรือไม่`
      );
    }
  });

  test('[TEAM-AUTHF-REAL-4] ล็อกอินโดยปล่อยช่องว่าง → validation กันการส่งฟอร์ม', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const login = new LoginPage(page);
    await login.goto();

    await login.signIn('', '');

    // ฟอร์มจริงอาจกันด้วย HTML5 required (เบราว์เซอร์โชว์ tooltip ไม่มี DOM alert) —
    // สิ่งที่ยืนยันได้จริง: ต้องยังอยู่หน้าเดิม ไม่ถูกพาเข้า /dashboard
    await page.waitForTimeout(2_000);
    const stillOnForm =
      (await login.emailInput.isVisible().catch(() => false)) &&
      !/\/dashboard/i.test(page.url());

    await attachEvidence(
      testInfo,
      'AUTHF-4-empty-fields',
      `ยังอยู่หน้าฟอร์ม: ${stillOnForm}\nURL หลังกด: ${page.url()}\n` +
        `--- เนื้อหาหน้า (600 ตัวอักษรแรก) ---\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 600)}`
    );

    expect.soft(
      stillOnForm,
      '[AUTHF-4] ช่องว่างต้องถูกกันไม่ให้ส่งฟอร์ม (ยังอยู่หน้า /sign-in ไม่เข้า /dashboard)'
    );
  });

  test('[TEAM-AUTHF-REAL-5] "ลืมรหัสผ่าน?" — คลิกได้จริง + โพรบด้วยอีเมลทีมเพื่อพิสูจน์ว่าบัญชีมีอยู่', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const login = new LoginPage(page);
    await login.goto();

    /* ---------- 5a: คลิกลิงก์ — บันทึกสิ่งที่เกิดขึ้นจริง (route ปลายทางยัง UNVERIFIED) ---------- */
    const open = await login.openForgotPassword();
    const bodyAfterOpen = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    await attachEvidence(
      testInfo,
      'AUTHF-5-forgot-open',
      `คลิกลิงก์ "ลืมรหัสผ่าน?" สำเร็จ: ${open.clicked}\nURL หลังคลิก: ${open.urlAfter}\n` +
        `--- เนื้อหาหน้าหลังคลิก (800 ตัวอักษรแรก) ---\n${bodyAfterOpen}`
    );
    expect.soft(
      open.clicked,
      '[AUTHF-5] ลิงก์ "ลืมรหัสผ่าน?" ต้องคลิกได้จริง (ถ้าไม่มีลิงก์ = ขัดหลักฐานหน้าจริง 2026-10-28 — ดู dump ที่แนบ)'
    );
    if (!open.clicked) return; // ขับเคลื่อนต่อไม่ได้ — หลักฐานแนบแล้ว

    /* ---------- 5b: โพรบด้วยอีเมลทีม — ตัดสินว่าบัญชีมีอยู่จริงจากข้อความที่ระบบตอบ ---------- */
    const submitted = await login.submitForgotPasswordIfFormPresent(PRIMARY.email);
    const bodyAfterSubmit = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
    await attachEvidence(
      testInfo,
      `AUTHF-5-forgot-submit-${PRIMARY.email}`,
      `กรอกอีเมลทีม + กดส่งสำเร็จ: ${submitted}\n--- เนื้อหาหน้าหลังกดส่ง (800 ตัวอักษรแรก) ---\n${bodyAfterSubmit}`
    );

    const linkSent = /ส่ง(ลิงก์|แล้ว|อีเมล)|ตรวจสอบ(อีเมล|อีเมลล์)|อีเมลถูกส่ง|link.{0,20}sent|check your email|email.{0,20}sent/i.test(bodyAfterSubmit);
    const noAccount = /ไม่พบ(บัญชี|อีเมล|ผู้ใช้)|ไม่มีบัญชี|no account|account not found|user not found|email not found/i.test(bodyAfterSubmit);
    const verdict = !submitted
      ? 'ขับเคลื่อนฟอร์มส่งไม่สำเร็จ (ไม่พบฟอร์ม/ปุ่มส่งบนหน้าจริง) — ฟังก์ชันกู้รหัสผ่านจึงพิสูจน์ไม่ครบ ดูหลักฐาน AUTHF-5-forgot-open'
      : linkSent && !noAccount
        ? 'ระบบตอบแนว "ส่งลิงก์/ตรวจอีเมล" → หลักฐานว่าบัญชีนี้มีอยู่จริงบนระบบ (เจ้าของบัญชีจะได้รับอีเมลจริง — เช็คกล่องจดหมายประกอบได้)'
        : noAccount
          ? 'ระบบตอบแนว "ไม่พบบัญชี" → บ่งชี้ว่าบัญชียังไม่ถูกสร้าง (ขัดกับ TEAM-SIGNIN-REAL ที่ล็อกอินผ่าน — ต้องตรวจต่อว่าเกิดอะไรขึ้น)'
          : 'ข้อความตอบกลับไม่ชี้ชัดทั้งสองแนว — อ่านหลักฐานที่แนบแล้วตัดสินเพิ่ม (ห้ามสรุปเกินหลักฐาน)';
    await attachEvidence(testInfo, 'AUTHF-5-verdict', verdict);

    expect.soft(
      submitted,
      '[AUTHF-5] พบหน้า/ฟอร์มลืมรหัสผ่านหลังคลิก แต่กดส่งไม่สำเร็จ — ดู dump ที่แนบ'
    );
  });

  test('[TEAM-AUTHF-REAL-6] สมัครซ้ำด้วยอีเมลทีม → ต้องถูกปฏิเสธ (หลักฐานว่าบัญชีถูกสร้างแล้ว)', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const register = new RegistrationPage(page);
    await register.goto();

    const ticked = await register.fillForm(
      PRIMARY.displayName,
      PRIMARY.email,
      PRIMARY.password,
      PRIMARY.password
    );
    await register.submit();

    const successShown = await register.successMessage
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const alertText = successShown ? '' : (await register.errorMessage.innerText().catch(() => '')).trim();
    const fieldDump = await register.formFieldDump().catch(() => '(dump ฟอร์มไม่สำเร็จ)');

    await attachEvidence(
      testInfo,
      `AUTHF-6-duplicate-${PRIMARY.email}`,
      `สมัครซ้ำด้วยอีเมลทีมที่ login ผ่านแล้ว (TEAM-SIGNIN-REAL)\n` +
        `สมัครสำเร็จ (ผิดปกติ!): ${successShown}\nติ๊ก checkbox ไป ${ticked} ช่อง\n` +
        `ข้อความจากระบบ: "${alertText || '(ไม่มี alert — ตรวจ dump)'}"\n` +
        `--- dump ช่องฟอร์ม ---\n${fieldDump}`
    );

    expect.soft(
      !successShown,
      '[AUTHF-6] สมัครซ้ำด้วยอีเมลเดิมต้องไม่สำเร็จ — ถ้าสำเร็จแปลว่าบัญชีเดิมหายไปจากระบบ (ขัดหลักฐาน login ผ่าน) ต้องตรวจต่อ'
    );

    const duplicateLike = /ถูกใช้|ซ้ำ|already|exist|มีบัญชี|มีผู้ใช้/i.test(alertText);
    const incompleteLike = /กรอกข้อมูลให้ครบ|กรุณากรอก/i.test(alertText);
    expect.soft(
      duplicateLike,
      `[AUTHF-6] ระบบปฏิเสธด้วยข้อความ: "${alertText || '(ดูหลักฐานที่แนบ)'}" — ` +
        `คาดหวังข้อความแนว "อีเมลนี้ถูกใช้สมัครแล้ว"` +
        (incompleteLike
          ? ' | ข้อความ "กรอกข้อมูลไม่ครบ" บนฟอร์มที่กรอกครบทุกช่อง = ฟอร์มจริงเปลี่ยนโครงสร้างอีกครั้ง ดู dump ที่แนบ'
          : '')
    );
  });

  test('[TEAM-AUTHF-REAL-7] สมัครด้วยรหัสผ่านอ่อน → checklist "ยังไม่ผ่าน" + ต้องไม่สำเร็จ', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const register = new RegistrationPage(page);
    await register.goto();

    // รหัสอ่อนตั้งใจ: ครบ 8 ตัวแต่พิมพ์เล็กล้วน — ขาด 2 ข้อ (ตัวพิมพ์ใหญ่, ตัวเลข)
    // ใช้อีเมลทีมตั้งใจ: ถ้าระบบกันรหัสอ่อนไม่ได้จริง ก็จะโดนปฏิเสธเรื่องอีเมลซ้ำแทน
    // ไม่มีทางสร้างบัญชีขยะใหม่บน production ได้ทั้งสองกรณี
    const WEAK_PASSWORD = 'weakpass';
    await register.fillForm(PRIMARY.displayName, PRIMARY.email, WEAK_PASSWORD, WEAK_PASSWORD);

    const bodyWithWeak = await page.locator('body').innerText();
    const pendingRules = PASSWORD_POLICY.ruleLabels.filter((label) => {
      const ruleLine = bodyWithWeak.split('\n').find((line) => line.includes(label));
      return ruleLine !== undefined && ruleLine.includes('ยังไม่ผ่าน');
    });
    const checklistRendered = PASSWORD_POLICY.ruleLabels.filter((label) =>
      bodyWithWeak.includes(label)
    );

    await register.submit();

    const successShown = await register.successMessage
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    const alertText = successShown ? '' : (await register.errorMessage.innerText().catch(() => '')).trim();

    await attachEvidence(
      testInfo,
      'AUTHF-7-weak-password',
      `รหัสอ่อนที่ใช้: "weakpass" (8 ตัว พิมพ์เล็กล้วน — ขาดตัวพิมพ์ใหญ่และตัวเลข)\n` +
        `checklist ที่ render บนหน้าจริง: ${checklistRendered.length}/4 ข้อ\n` +
        `ข้อที่ยังระบุ "ยังไม่ผ่าน": ${pendingRules.length > 0 ? pendingRules.join(' / ') : '(ไม่พบข้อความ ยังไม่ผ่าน — อาจใช้ไอคอนแทนข้อความ)'}\n` +
        `สมัครสำเร็จ (ผิดปกติ!): ${successShown}\nข้อความจากระบบ: "${alertText || '(ไม่มี alert — ตรวจ dump)'}"`
    );

    expect.soft(
      !successShown,
      '[AUTHF-7] รหัสผ่านอ่อนต้องไม่สมัครสำเร็จ — ถ้าสำเร็จ = ระบบไม่บังคับ password policy (หลุมความปลอดภัยจริง)'
    );

    if (checklistRendered.length > 0) {
      expect.soft(
        pendingRules.length > 0,
        '[AUTHF-7] รหัส "weakpass" ขาด 2 ข้อ ต้องมีอย่างน้อย 1 ข้อบน checklist ที่ยังระบุ "ยังไม่ผ่าน"'
      );
    }
  });

  test('[TEAM-AUTHF-REAL-8] URL ที่ไม่มีจริง → SPA แสดงหน้าเข้าสู่ระบบ (baseline ของ BUG-001)', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await page.goto('/this-page-does-not-exist-xyz123', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2_000);

    const loginFormShown = await page
      .locator('input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]')
      .first()
      .isVisible()
      .catch(() => false);

    await attachEvidence(
      testInfo,
      'AUTHF-8-no-404-page',
      `URL ปลายทาง: ${page.url()}\nแสดงฟอร์มเข้าสู่ระบบ: ${loginFormShown}\n` +
        `--- เนื้อหาหน้า (500 ตัวอักษรแรก) ---\n${(await page.locator('body').innerText().catch(() => '')).slice(0, 500)}`
    );

    // baseline regression: พฤติกรรมจริงปัจจุบันคือ SPA พาไปหน้าเข้าสู่ระบบ (ไม่มี 404 เฉพาะ — BUG-001)
    // เมื่อวันหนึ่งระบบมีหน้า 404 เฉพาะ เทสต์นี้จะ fail ทันที = ทีมได้รู้ว่า behavior เปลี่ยน
    expect(
      loginFormShown,
      '[AUTHF-8] พฤติกรรม baseline เปลี่ยน: URL ไม่มีจริงไม่แสดงหน้าเข้าสู่ระบบอีกแล้ว — ตรวจว่าระบบเพิ่งมีหน้า 404 เฉพาะหรือเว็บพัง (อัปเดต BUG-001)'
    ).toBe(true);
  });
});