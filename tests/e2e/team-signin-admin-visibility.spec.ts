import { test, expect } from '../../fixtures/test-fixtures';
import { APP } from '../../config/config';
import { TEAM_USERS, hasTeamCredentials } from '../../fixtures/test-data';
import { LoginPage } from '../../pages/LoginPage';
import { RegistrationPage } from '../../pages/RegistrationPage';
import { AdminDashboardPage } from '../../pages/AdminDashboardPage';

/**
 * ============================================================
 * TEAM-SIGNIN-ADM — "sign in → log in → ข้อมูลแสดงใน /admin"
 * ด้วยบัญชีทีมงานจริง 3 คนตามคำสั่งผู้ใช้ (ห้ามใช้ชื่ออื่น)
 * ============================================================
 *   KANYARAT PATTHANAN   — HR & Recruitment   (kanyarat.p.hr@gmail.com)
 *   PHIRAPHAT CHAYANON   — Finance & Financial Analyst (phiraphat.c.finance@gmail.com)
 *   VARIN METHAWEE       — UI/UX Product Design (varin.m.uxui@gmail.com)
 *
 * ต่างจาก TEAM-ADM (team-users-admin-visibility.spec.ts) ตรงที่:
 *   - ไม่ผ่านขั้น register ในชุด MOCK — พิสูจน์เฉพาะสาย "login เฉย ๆ
 *     ต้องทำให้ตัวตนปรากฏในตาราง Users ของ /admin" (touchMockUser
 *     ใส่ displayName ทีมให้ตอน login — ยืนยันใน test-fixtures.ts:254-255
 *     และ mock-app-server.js:214-215)
 *
 * ชุด REAL บน https://learnace.tech (MOCK_API=false):
 *   ขั้น 1 SIGN IN (สมัคร — ยอมรับทั้ง success/อีเมลซ้ำ เพื่อให้บัญชีมีอยู่จริง)
 *   ขั้น 2 LOG IN (assert เข้ม: ต้องถึง /dashboard)
 *   ขั้น 3 /admin ต้องแสดงข้อมูล user — เก็บหลักฐานครบ:
 *     (a) การยิง /api/admin/** จริง (url + status ทุก call)
 *     (b) URL สุดท้าย + เนื้อหาหน้า
 *     และตัดสินตามหลักฐานเสมอ — ถ้า API ตอบ 401/403 = บัญชีไม่มี role ADMIN
 *     → FAIL พร้อมเหตุผล (ห้ามปลอมผลผ่าน)
 */

/* ============================================================
 * ชุด MOCK — ซ้อม flow บนแอปจำลอง (DOM+API ของเฟรมเวิร์กเอง)
 * ============================================================ */
test.describe('TEAM-SIGNIN-ADM (MOCK) — log in อย่างเดียว → ตัวตนต้องแสดงใน /admin', () => {
  test.skip(
    !APP.mockApi || !APP.isMockAppServer,
    'ชุดนี้รันเฉพาะ MOCK_API=true + BASE_URL ชี้ mock app server (http://127.0.0.1:4310)'
  );

  for (const member of TEAM_USERS) {
    test(`[TEAM-SIGNIN-ADM] ${member.displayName} (${member.department}) — log in → เห็นตัวเองใน /admin`, async ({ page }) => {
      /* ---------- ขั้น 1: LOG IN โดยตรง (ไม่ register) ---------- */
      await page.goto('/sign-in', { waitUntil: 'domcontentloaded' });
      await page.locator('#email').fill(member.email);
      await page.locator('#password').fill(member.password);
      await page.locator('#login-btn').click();

      // หลักฐานชั้น 1: sign in ต้องพาไปถึง /dashboard
      await expect(page).toHaveURL(/\/dashboard/i);

      /* ---------- ขั้น 2: /admin ต้องแสดงตัวตนของคนที่เพิ่ง log in ---------- */
      await page.goto('/admin', { waitUntil: 'domcontentloaded' });

      const usersTable = page.getByTestId('users-table');

      // หลักฐานชั้น 2: ชื่อจริงของทีม (ไม่ใช่ email prefix) ต้องอยู่ในตาราง
      await expect(usersTable).toContainText(member.displayName);
      // หลักฐานชั้น 3: อีเมลของคนนั้นต้องอยู่ในตารางด้วย
      await expect(usersTable).toContainText(member.email);
    });
  }
});

/* ============================================================
 * ชุด REAL — learnace.tech จริง (เครื่องผู้ใช้, MOCK_API=false)
 * ============================================================ */
test.describe('TEAM-SIGNIN-REAL — sign in → log in → แสดงใน learnace.tech/admin', () => {
    /** รายชื่อรหัสผ่านทีมที่ยังไม่ถูกตั้งใน .env — ใช้บอกผู้รันเป๊ะ ๆ ว่าขาดอะไร แทนข้อความกว้าง ๆ */
  const missingTeamPasswords = [
    'TEAM_KANYARAT_PASSWORD',
    'TEAM_PHIRAPHAT_PASSWORD',
    'TEAM_VARIN_PASSWORD',
  ].filter((key) => !(process.env[key] || '').length);

  test.skip(
    APP.mockApi || !hasTeamCredentials(),
    'BLOCKED: เงื่อนไขรันชุด REAL ยังไม่ครบ = ห้ามยิง production (กฎเฟรมเวิร์ก: ไม่มีหลักฐานสิทธิ์ = ไม่รัน) — ' +
      [
        APP.mockApi
          ? 'MOCK_API ต้องเป็น false ตัวพิมพ์เล็กเป๊ะ ๆ แต่ตอนนี้ = ' + JSON.stringify(process.env.MOCK_API ?? null)
          : null,
        missingTeamPasswords.length > 0
          ? 'ยังไม่ได้ตั้งใน .env: ' + missingTeamPasswords.join(', ')
          : null,
      ]
        .filter(Boolean)
        .join(' | ') +
      ' — ตรวจละเอียดด้วยคำสั่ง: node scripts/check-env.js'
  );

  /** เก็บหลักฐานข้อความ/ภาพลงรายงาน HTML (แนบได้แม้เทสต์ fail) */
  async function attachEvidence(
    testInfo: { attach(name: string, options: { body: string | Buffer; contentType: string }): Promise<void> },
    name: string,
    text: string
  ): Promise<void> {
    await testInfo.attach(name, { body: text.slice(0, 2000), contentType: 'text/plain' });
  }

  for (const member of TEAM_USERS) {
    test(
      `[TEAM-SIGNIN-REAL] ${member.displayName} — sign in → log in → แสดงใน learnace.tech/admin`,
      async ({ page }, testInfo) => {
        test.setTimeout(420_000); // เว็บจริงอยู่หลัง Cloudflare tunnel — จองเวลาให้ครบทุกขั้น

        /* ---------- ขั้น 1: SIGN IN (สมัคร) — เก็บข้อความจริงจากระบบเสมอ ----------
         * บทเรียนจากรอบ 2026-10-28: เดิมแนบข้อสันนิษฐาน "อีเมลถูกใช้แล้ว" ทั้งที่ยังไม่ได้
         * อ่านข้อความจริงของระบบ — ตอนนี้อ่าน alert จริง + เนื้อหาหน้า ทุกครั้งที่ถูกปฏิเสธ
         * บทเรียนที่ 2 (รอบเดียวกัน): ระบบจริงปฏิเสธว่า "กรุณากรอกข้อมูลให้ครบถ้วน" ทั้งที่กรอก
         * ครบ 4 ช่อง → ฟอร์มจริงมี checkbox ยอมรับนโยบายที่ automation ไม่เคยติ๊ก —
         * ตอนนี้ fillForm ติ๊ก checkbox ให้เอง และแนบ dump ช่องทั้งหมดเป็นหลักฐานเสมอ */
        let registerRejectionText = '';
        let registerCheckboxTicked = -1;
        try {
          const registration = new RegistrationPage(page);
          await registration.goto();
          registerCheckboxTicked = await registration.fillForm(
            member.displayName,
            member.email,
            member.password,
            member.password
          );
          await registration.submit();

          const successShown = await registration.successMessage
            .waitFor({ state: 'visible', timeout: 10_000 })
            .then(() => true)
            .catch(() => false);

          const errorShown = successShown
            ? false
            : await registration.errorMessage
                .waitFor({ state: 'visible', timeout: 5_000 })
                .then(async () => {
                  registerRejectionText = (await registration.errorMessage.innerText().catch(() => '')).trim();
                  return true;
                })
                .catch(() => false);

          const evidence = successShown
            ? `SIGN IN=สำเร็จ (บัญชีถูกสร้างใหม่) | ติ๊ก checkbox ไป ${registerCheckboxTicked} ช่อง`
            : errorShown
              ? `SIGN IN=ระบบปฏิเสธ — ข้อความจริงจากระบบ: "${
                  registerRejectionText || '(มี alert แต่อ่านข้อความไม่ได้ — ดูเนื้อหาหน้าด้านล่าง)'
                }" | ติ๊ก checkbox ไป ${registerCheckboxTicked} ช่อง | URL: ${page.url()}`
              : 'SIGN IN=ฟอร์มไม่ตอบสนองภายใน 15 วินาที (ไม่มี success/error ใดแสดง — เช็คว่าฟอร์มต้องติ๊กยอมรับก่อนหรือไม่)';
          const registerBody = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
          await attachEvidence(
            testInfo,
            `REAL-1-signin-${member.email}`,
            `${evidence}\n--- หน้า /register ตอนปลายทาง (800 ตัวอักษรแรก) ---\n${registerBody}`
          );
          if (!successShown) {
            const fieldDump = await registration.formFieldDump().catch(() => '(dump ฟอร์มไม่สำเร็จ)');
            await attachEvidence(
              testInfo,
              `REAL-1-form-fields-${member.email}`,
              `ช่องทั้งหมดบน /register ตอนถูกปฏิเสธ (ใช้พิสูจน์ว่าช่องไหนว่าง / checkbox ไหนยังไม่ติ๊ก):\n` +
                `ติ๊ก checkbox สำเร็จ ${registerCheckboxTicked} ช่อง\n${fieldDump}`
            );
          }
          expect.soft(
            successShown || errorShown,
            `[${member.displayName}] ขั้น 1 SIGN IN: ฟอร์มต้องตอบสนอง — ${evidence}`
          );
        } catch (error) {
          await attachEvidence(testInfo, `REAL-1-signin-${member.email}`, `STEP_ERROR: ${String(error)}`);
          expect.soft(false, `[${member.displayName}] ขั้น 1 SIGN IN ขับเคลื่อนไม่สำเร็จ — ดูหลักฐานแนบ`);
        }

        /* ---------- ขั้น 2: LOG IN — ถ้าระบบจริงปฏิเสธ ต้องจับข้อความจริง + ภาพ ก่อน fail ----------
         * บทเรียนจากรอบ 2026-10-28: เดิม assert แค่ URL ทำให้รู้แค่ "ไม่ผ่าน" แต่ไม่รู้ว่าระบบ
         * ปฏิเสธเพราะอะไร (รหัสไม่ตรง / ไม่พบบัญชี / บั๊กเว็บ) — ตอนนี้จับข้อความแดง +
         * screenshot ภายใน 6 วินาทีแรก (กัน toast หายตัว) แล้ว fail พร้อมวินิจฉัย
         * บทเรียนที่ 2: ห้ามสรุปว่า "อีเมลหรือรหัสผ่านไม่ถูกต้อง" = "รหัสผิด เพราะบัญชีมีอยู่" —
         * ข้อความนี้เจตนาให้กลาง ๆ ทั้งกรณีรหัสผิด/ไม่มีบัญชี ต้องรายงานทุกสมมติฐาน ห้ามเลือกข้าง */
        const login = new LoginPage(page);
        await login.goto();
        await login.signIn(member.email, member.password);

        const rejectNow = await login.errorMessage
          .waitFor({ state: 'visible', timeout: 6_000 })
          .then(() => true)
          .catch(() => false);

        if (rejectNow) {
          const alertText = (await login.errorMessage.innerText().catch(() => '')).trim();
          const bodyAtFail = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
          const shot = await page.screenshot().catch(() => null);
          if (shot) {
            await testInfo.attach(`REAL-2-login-fail-shot-${member.email}`, {
              body: shot,
              contentType: 'image/png'
            });
          }
          await attachEvidence(
            testInfo,
            `REAL-2-login-FAIL-${member.email}`,
            `LOG IN ถูกระบบจริงปฏิเสธ (ภายใน 6 วินาที) — URL: ${page.url()}\n` +
              `ข้อความจากระบบ (alert): "${alertText || '(ไม่มี alert ที่จับได้ — ดูภาพที่แนบ)'}"\n` +
              `รหัสผ่านที่ใช้: ค่า TEAM_*_PASSWORD จากไฟล์ .env\n` +
              `--- เนื้อหาหน้าตอนถูกปฏิเสธ (800 ตัวอักษรแรก) ---\n${bodyAtFail}`
          );
          const explicitNoAccount =
            /ไม่พบบัญชี|ไม่พบผู้ใช้|ไม่พบอีเมล|ไม่มีบัญชี|ยังไม่ได้ลงทะเบียน|no account|user not found|account not found/i.test(alertText);
          const genericAuthReject =
            /อีเมลหรือรหัสผ่าน|email or password|invalid credentials|incorrect|wrong/i.test(alertText);
          const diagnosis = explicitNoAccount
            ? 'ระบบบอกชัดว่าไม่พบบัญชี → บัญชียังไม่ถูกสร้างบนระบบจริง — ดูหลักฐาน REAL-1-signin + REAL-1-form-fields ว่าขั้นสมัครติดที่ช่องไหน แก้ให้สมัครสำเร็จก่อน'
            : genericAuthReject
              ? 'ข้อความปฏิเสธแบบกลาง ๆ ไม่ระบุว่ารหัสผิดหรือไม่มีบัญชี — ต้องตัดสินด้วยหลักฐานเพิ่ม มี 3 สมมติฐาน: ' +
                '(1) รหัสผ่านใน .env ไม่ตรงกับบนระบบ ' +
                `(2) บัญชียังไม่มีอยู่จริง — ขั้น 1 สมัครถูกปฏิเสธด้วยข้อความ "${registerRejectionText || 'กรุณากรอกข้อมูลให้ครบถ้วน'}" จึงยังไม่มีหลักฐานว่าบัญชีเคยถูกสร้าง ` +
                '(3) บัญชีถูกสร้างผ่านปุ่ม Google จึงไม่มีรหัสผ่านให้ล็อกอินด้วยอีเมล — ' +
                'วิธีตัดสิน 3 นาที: ล็อกอินด้วยมือ 1 บัญชี หรือกด "ลืมรหัสผ่าน?" ด้วยอีเมลนั้น → ' +
                'ระบบส่งลิงก์ = บัญชีมีอยู่ (ตั้งรหัสใหม่แล้วอัปเดต .env) / ระบบบอกไม่พบอีเมล = บัญชียังไม่ถูกสร้าง'
              : 'ข้อความไม่ชี้สาเหตุชัดเจน → เปิดภาพที่แนบ (REAL-2-login-fail-shot) อ่านข้อความสีแดงบนหน้าจริง';
          throw new Error(
            `[${member.displayName}] ขั้น 2 LOG IN: ระบบจริงปฏิเสธการเข้าสู่ระบบ (URL: ${page.url()})\n` +
              `ข้อความจากระบบ: "${alertText || '(ดูหลักฐาน REAL-2-login-FAIL ที่แนบ)'}"\n` +
              `วินิจฉัย: ${diagnosis}`
          );
        }

        try {
          await login.expectLoginSuccess();
        } catch {
          // ไม่มี alert จับได้ แต่ก็ไม่ยอมพาไป /dashboard ใน 30 วินาที — จับหลักฐานแล้ว fail
          const bodyAtFail = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
          const shot = await page.screenshot().catch(() => null);
          if (shot) {
            await testInfo.attach(`REAL-2-login-timeout-shot-${member.email}`, {
              body: shot,
              contentType: 'image/png'
            });
          }
          await attachEvidence(
            testInfo,
            `REAL-2-login-FAIL-${member.email}`,
            `LOG IN ไม่มี alert และไม่ยอมไป /dashboard ภายใน 30 วินาที — URL ค้างที่: ${page.url()}\n` +
              `--- เนื้อหาหน้า ณ หมดเวลา (800 ตัวอักษรแรก) ---\n${bodyAtFail}`
          );
          throw new Error(
            `[${member.displayName}] ขั้น 2 LOG IN: ระบบจริงไม่พาไป /dashboard และไม่แสดงข้อความใด ` +
              `(URL ค้างที่ ${page.url()}) — ดูภาพ/screenshot ที่แนบ รวมถึงความเป็นไปได้: เว็บจริงมีบั๊กที่หน้า log in`
          );
        }

        await page.waitForTimeout(2_000);
        await attachEvidence(
          testInfo,
          `REAL-2-login-${member.email}`,
          `LOG IN สำเร็จ — URL: ${page.url()}\n--- หน้า Dashboard (400 ตัวอักษรแรก) ---\n` +
            (await page.locator('body').innerText()).slice(0, 400)
        );

        /* ---------- ขั้น 3: /admin ต้องแสดงข้อมูล user (แกนหลักของคำขอ) ---------- */
        // ดักทุก response ของ /api/admin/** เป็นหลักฐานระดับเครือข่าย
        const adminApiCalls: { url: string; status: number }[] = [];
        page.on('response', (response) => {
          if (response.url().includes('/api/admin/')) {
            adminApiCalls.push({ url: response.url(), status: response.status() });
          }
        });

        await page.goto('/admin', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(6_000); // เวลาให้ SPA จริง render + ยิง API

        const finalUrl = page.url();
        const bodyText = await page.locator('body').innerText();
        const admin = new AdminDashboardPage(page);
        const usersTableVisible = await admin.usersTable.isVisible().catch(() => false);
        const identityShown =
          bodyText.includes(member.displayName) || bodyText.includes(member.email);

        await attachEvidence(
          testInfo,
          `REAL-3-admin-${member.email}`,
          `URL สุดท้าย: ${finalUrl}\n` +
            `เรียก /api/admin/**: ${adminApiCalls.length} call\n` +
            adminApiCalls.map((c) => `  ${c.status} ${c.url}`).join('\n') +
            `\nตาราง Users แสดง: ${usersTableVisible}\n` +
            `เห็นตัวตน (ชื่อ/อีเมล): ${identityShown}\n` +
            `--- เนื้อหาหน้า /admin (1000 ตัวอักษรแรก) ---\n${bodyText.slice(0, 1000)}`
        );

        // (a) ต้องมีการเรียก API admin จริง — ถ้า 0 call = ถูก auth gate ตบหน้าตั้งแต่ยังไม่เข้า
        expect.soft(
          adminApiCalls.length > 0,
          `[${member.displayName}] ขั้น 3: หน้า /admin ต้องเรียก /api/admin/** อย่างน้อย 1 ครั้ง — ` +
            `ได้ ${adminApiCalls.length} call (URL สุดท้าย ${finalUrl}) = ถูก auth gate เด้งก่อนโหลดข้อมูล ` +
            '(สาเหตุที่พบบ่อย: บัญชีไม่มี role ADMIN บนระบบจริง)'
        );

        // (b) ทุก call ต้องไม่ติดสิทธิ์ — 401/403 = ล็อกอินผ่านแต่ role ไม่ใช่ ADMIN
        const denied = adminApiCalls.filter((c) => c.status === 401 || c.status === 403);
        expect.soft(
          denied.length === 0,
          `[${member.displayName}] ขั้น 3: /api/admin/** ตอบ ${denied.map((d) => d.status).join(', ')} — ` +
            `LOG IN สำเร็จแล้วแต่บัญชี ${member.email} ไม่มี role ADMIN บนระบบจริง → ` +
            'ต้องเปลี่ยน role ของบัญชีเป็น ADMIN ก่อน ข้อมูลจึงจะแสดงใน /admin ได้ (ห้ามปลอมผลผ่าน)'
        );

        // (c) ตาราง Users ต้อง render จริง
        expect.soft(
          usersTableVisible,
          `[${member.displayName}] ขั้น 3: ตาราง Users ของ /admin ต้องแสดง — ` +
            'ถ้า fail = DOM จริงไม่มีตาราง (ตรวจหลักฐาน REAL-3-admin ที่แนบในรายงาน)'
        );

        // (d) ตัวตนที่เพิ่ง log in ต้องปรากฏบนหน้า /admin (ชื่อหรืออีเมล)
        expect.soft(
          identityShown,
          `[${member.displayName}] ขั้น 3: /admin ต้องแสดง "${member.displayName}" ` +
            `หรือ "${member.email}" หลัง log in — ปัจจุบันไม่พบในเนื้อหาหน้า (ดูหลักฐาน REAL-3-admin)`
        );
      }
    );
  }
});