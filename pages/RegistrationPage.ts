import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { PASSWORD_POLICY } from '../config/config';

/**
 * RegistrationPage — หน้าสมัครสมาชิก (/register)
 *
 * หลักฐานจากการเข้าเว็บจริง (หน้า /register, รอบ 2026-10-28 ครั้งที่ 2):
 *   - ฟอร์มจริงแยกช่องชื่อเป็น 2 ช่อง: #firstName (placeholder "กรอกชื่อ")
 *     และ #lastName (placeholder "กรอกนามสกุล") — พิสูจน์จาก formFieldDump:
 *       [0] id="firstName" value="Kanyarat Patthanan"  ← ยัดชื่อเต็มลงช่องเดียว
 *       [1] id="lastName"  value=""                    ← นามสกุลว่าง = ถูกปฏิเสธ
 *     สาเหตุ "กรุณากรอกข้อมูลให้ครบถ้วน" คือ lastName ว่าง ไม่ใช่ checkbox
 *   - สมมติฐาน "มี checkbox ยอมรับนโยบายต้องติ๊ก" ถูกหักล้างด้วยหลักฐาน:
 *     tickAllVisibleCheckboxes คืน 0 ช่องทั้ง 3 บัญชี = หน้า /register จริงไม่มี
 *     checkbox ให้ติ๊ก (มีแต่ข้อความนโยบาย)
 *   - Password policy แสดงแบบ real-time checklist 4 ข้อ:
 *       "อย่างน้อย 8 ตัวอักษร" / "ตัวพิมพ์ใหญ่ (A–Z)" /
 *       "ตัวพิมพ์เล็ก (a–z)"   / "ตัวเลข (0–9)"
 *   - มีปุ่ม Google OAuth + ลิงก์ "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ"
 *   - แอปจำลอง (mock-app-server) ใช้ช่องเดียว #name "ชื่อนามสกุล" — fillForm
 *     จึงเลือกโหมดกรอกอัตโนมัติ: มีช่องแยก = แยกกรอก, ไม่มี = กรอกช่องเดียว
 */
export class RegistrationPage extends BasePage {
  readonly firstNameInput: Locator;
  readonly lastNameInput: Locator;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly googleButton: Locator;
  readonly loginLink: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    super(page);

    /** ช่องชื่อ-นามสกุลแบบแยก (ฟอร์มจริง learnace.tech — ยืนยัน id จาก formFieldDump) */
    this.firstNameInput = page
      .locator(
        '#firstName, input[name="firstName"], ' +
          'input[placeholder*="ชื่อ" i]:not([placeholder*="นามสกุล" i])'
      )
      .first();

    this.lastNameInput = page
      .locator(
        '#lastName, input[name="lastName"], ' +
          // กันฟอร์มช่องเดียว placeholder "ชื่อนามสกุล" (มีทั้งคำว่า ชื่อ และ นามสกุล) —
          // ต้องไม่ตรวจเป็นช่องนามสกุลแบบแยก มิฉะนั้น fillForm จะเลือกโหมดแยกช่องผิดบนแอปจำลอง
          'input[placeholder*="นามสกุล" i]:not([placeholder*="ชื่อ" i])'
      )
      .first();

    /** ช่องชื่อแบบช่องเดียว (แอปจำลอง / ฟอร์มรูปแบบเก่า) */
    this.nameInput = page
      .locator(
        'input[name="name"], input[name="fullName"], input[placeholder*="ชื่อ" i], ' +
        'input[placeholder*="name" i], input:not([type="email"]):not([type="password"]):not([type="file"]):below(:text("ชื่อ"))'
      )
      .first();

    this.emailInput = page
      .locator(
        'input[type="email"], input[name="email"], input[placeholder*="อีเมล" i]'
      )
      .first();

    // ช่องรหัสผ่านสองช่องแรกบนฟอร์ม (รหัสผ่าน, ยืนยันรหัสผ่าน)
    const passwordFields = page.locator('input[type="password"]');
    this.passwordInput = passwordFields.nth(0);
    this.confirmPasswordInput = passwordFields.nth(1);

    this.submitButton = page
      .locator(
        'button[type="submit"], ' +
        'form button:has-text("สมัครสมาชิก"), ' +
        'button:has-text("Register"), button:has-text("Sign Up")'
      )
      .first();

    this.googleButton = page
      .getByRole('button', { name: /google/i })
      .or(page.getByRole('link', { name: /google/i }))
      .first();

    this.loginLink = page
      .getByRole('link', { name: /เข้าสู่ระบบ|sign\s*in|log\s*in/i })
      .first();

    this.errorMessage = page
      .locator(
        '[role="alert"], [data-testid="register-error"], ' +
        '.error-message, .form-error, [class*="error" i][class*="message" i]'
      )
      .first();

    this.successMessage = page
      .locator(
        '[role="status"], [data-testid="register-success"], ' +
        '.success-message, [class*="success" i]'
      )
      .first();
  }

  /** เปิดหน้าสมัครสมาชิก (route จริง: /register) */
  async goto(): Promise<void> {
    await this.page.goto('/register', { waitUntil: 'domcontentloaded' });
    await this.emailInput.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * กรอกฟอร์มสมัครให้ตรงโครงสร้างจริงของหน้า + ติ๊ก checkbox ทุกอันที่มองเห็น
   *
   * บทเรียนจากรอบ 2026-10-28 ครั้งที่ 2 (เว็บจริง learnace.tech): ฟอร์มจริงแยก
   * #firstName / #lastName เป็น 2 ช่อง — การยัด "ชื่อ นามสกุล" ทั้งก้อนลงช่องเดียว
   * ทำให้ lastName ว่าง และระบบปฏิเสธ "กรุณากรอกข้อมูลให้ครบถ้วน" ทุกบัญชี
   * (พิสูจน์จากหลักฐาน REAL-1-form-fields: [1] id="lastName" value="")
   *
   * กติกาเลือกโหมดกรอก:
   *   - เห็นช่อง lastName  → แยกชื่อ: คำแรก → firstName, ที่เหลือทั้งหมด → lastName
   *   - ไม่เห็นช่อง lastName → กรอกช่องเดียว (nameInput) ตามฟอร์มแบบเดิม/แอปจำลอง
   *
   * คืนจำนวน checkbox ที่ติ๊กสำเร็จ (แนบเป็นหลักฐานในรายงาน — ฟอร์มจริงพบ 0 ช่อง)
   */
  async fillForm(name: string, email: string, password: string, confirmPassword: string): Promise<number> {
    let hasSplitName =
      (await this.firstNameInput.isVisible().catch(() => false)) &&
      (await this.lastNameInput.isVisible().catch(() => false));
    if (hasSplitName) {
      // ชั้นกันพลาดสุดท้าย: สอง locator ต้องชี้ input คนละตัวกันจริง
      // (กรณีฟอร์มช่องเดียวที่ locator ทั้งคู่ไปโดน input เดียวกัน)
      hasSplitName = await this.areDifferentInputs(this.firstNameInput, this.lastNameInput);
    }

    if (hasSplitName) {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0] ?? name;
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
      await expect(this.firstNameInput).toBeVisible();
      await this.firstNameInput.fill(firstName);
      await this.lastNameInput.fill(lastName);
    } else {
      await expect(this.nameInput).toBeVisible();
      await this.nameInput.fill(name);
    }

    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    return this.tickAllVisibleCheckboxes();
  }

  /**
   * ติ๊ก checkbox ที่มองเห็นทั้งหมดที่ยังไม่ถูกติ๊ก
   * คืนจำนวนช่องที่ติ๊กสำเร็จ — ไม่ throw เมื่อไม่มี checkbox
   * (หลักฐานรอบ 2026-10-28: หน้า /register จริงไม่มี checkbox เลย ได้ 0 ทุกบัญชี)
   */
  async tickAllVisibleCheckboxes(): Promise<number> {
    const boxes = this.page.locator('input[type="checkbox"]');
    const total = await boxes.count();
    let ticked = 0;
    for (let i = 0; i < total; i++) {
      const box = boxes.nth(i);
      if (!(await box.isVisible().catch(() => false))) continue;
      if (await box.isChecked().catch(() => true)) continue;
      try {
        await box.check({ timeout: 3_000 });
        ticked++;
      } catch {
        // checkbox แบบ custom (input ซ่อน + สไตล์เอง) — ลอง check แบบ force แล้วคลิก label แทน
        try {
          await box.check({ force: true, timeout: 2_000 });
          ticked++;
        } catch {
          const id = await box.getAttribute('id').catch(() => null);
          if (id) {
            await this.page
              .locator(`label[for="${id}"]`)
              .first()
              .click({ force: true, timeout: 2_000 })
              .catch(() => {});
            if (await box.isChecked().catch(() => false)) ticked++;
          }
        }
      }
    }
    return ticked;
  }

  /**
   * dump ทุก input/select/textarea บนหน้าเป็นข้อความ — แนบเป็นหลักฐานเมื่อระบบบอก
   * "กรอกข้อมูลไม่ครบ" เพื่อพิสูจน์ว่าจริง ๆ ช่องไหนหาย/checkbox ไหนยังว่าง
   * (ตัด value ที่ 24 ตัวอักษรเพื่อให้แต่ละบรรทัดสั้นพอที่รายงาน terminal จะไม่ตัดทอน)
   */
  async formFieldDump(): Promise<string> {
    const fields = this.page.locator('input, select, textarea');
    const total = await fields.count();
    const lines: string[] = [];
    for (let i = 0; i < Math.min(total, 30); i++) {
      const f = fields.nth(i);
      const describe = await f
        .evaluate((el) => {
          const e = el as HTMLInputElement;
          const attr = (a: string) => e.getAttribute(a);
          return [
            `<${e.tagName.toLowerCase()}`,
            e.getAttribute('type') ? ` type="${e.getAttribute('type')}"` : '',
            attr('name') ? ` name="${attr('name')}"` : '',
            attr('id') ? ` id="${attr('id')}"` : '',
            attr('placeholder') ? ` placeholder="${attr('placeholder')}"` : '',
            e.hasAttribute('required') ? ' [required]' : '',
            ' value=' + JSON.stringify(e.value.slice(0, 24)),
            ' visible=' + !!(e.offsetWidth || e.offsetHeight),
            e.type === 'checkbox' ? ' checked=' + e.checked : '',
            '>'
          ].join('');
        })
        .catch(() => `  (#${i} อ่านค่าไม่ได้)`);
      lines.push(`  [${i}] ${describe}`);
    }
    return lines.length > 0 ? lines.join('\n') : '  (ไม่พบ input ใดบนหน้า)';
  }

  /** เทียบว่า locator สองตัวชี้ element เดียวกันหรือไม่ (true = คนละตัวกัน) */
  private async areDifferentInputs(a: Locator, b: Locator): Promise<boolean> {
    const [handleA, handleB] = await Promise.all([
      a.elementHandle().catch(() => null),
      b.elementHandle().catch(() => null),
    ]);
    if (!handleA || !handleB) return false;
    const same = await handleA
      .evaluate((el, other) => el === other, handleB)
      .catch(() => true); // เทียบไม่ได้ = ถือว่าเดียวกัน (เลือกโหมดช่องเดียว ปลอดภัยกว่า)
    return !same;
  }

  /** กดปุ่มสมัครสมาชิก */
  async submit(): Promise<void> {
    await expect(this.submitButton).toBeEnabled();
    await this.submitButton.click();
  }

  /**
   * อ่านสถานะของ password checklist แต่ละข้อ — คืนค่า true เมื่อข้อนั้น "ผ่าน" แล้ว
   * กติกา: ข้อความที่ยังไม่ผ่านจะมีคำว่า "ยังไม่ผ่าน" ต่อท้าย (จากหน้าเว็บจริง)
   */
  async passwordRulePassed(index: number): Promise<boolean> {
    const bodyText = await this.page.locator('body').innerText();
    const label = PASSWORD_POLICY.ruleLabels[index];
    const ruleLine = bodyText
      .split('\n')
      .find((line) => line.includes(label));

    if (ruleLine === undefined) {
      // หาไม่เจอ = อาจแสดงเป็น indicator กราฟิก — ให้ถือว่า "มี rule แสดงอยู่" แบบไม่ระบุสถานะ
      return false;
    }
    return !ruleLine.includes('ยังไม่ผ่าน');
  }

  /** ยืนยันว่า checklist กติการหัสผ่าน 4 ข้อแสดงอยู่บนฟอร์ม */
  async expectPasswordPolicyVisible(): Promise<void> {
    const bodyText = await this.page.locator('body').innerText();
    for (const label of PASSWORD_POLICY.ruleLabels) {
      expect(
        bodyText,
        `Password rule "${label}" ต้องแสดงบนหน้าสมัครสมาชิก`
      ).toContain(label);
    }
  }

  /** ยืนยันว่ามีข้อความ error แสดง (validation หรือ backend error) */
  async expectError(pattern?: RegExp): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
    if (pattern) {
      await expect(this.errorMessage).toContainText(pattern);
    }
  }

  /** ยืนยันว่าสมัครสมาชิกสำเร็จ (message สำเร็จ หรือถูกพาไปหน้าถัดไป) */
  async expectRegistrationSuccess(): Promise<void> {
    const successShown = await this.successMessage
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!successShown) {
      // บาง flow จะพาไป /sign-in หรือ /dashboard หลังสมัครสำเร็จ
      await expect(this.page).toHaveURL(/sign-in|login|dashboard/i, { timeout: 15_000 });
    }
  }
}