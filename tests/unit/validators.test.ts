import { describe, it, expect } from 'vitest';
import {
  isPasswordPolicyCompliant,
  isDuplicateEmail,
  isLoginRejected,
  isUploadRejected,
} from '../../helpers/validators';

/**
 * ============================================================
 * Unit Tests — helpers/validators.ts (กติกาธุรกิจของ Mock API)
 * ============================================================
 * map กับฟังก์ชันของเว็บ:
 *  - Sign In       → isLoginRejected (negative fixtures: .invalid / Wrong*)
 *  - Register      → isPasswordPolicyCompliant + isDuplicateEmail
 *  - Resume Upload → isUploadRejected (blacklist + ลิมิต 5MB)
 *
 * หมายเหตุความจริง: กติกาเหล่านี้เป็นของ mock layer — password policy
 * 4 ข้อยืนยันมาจากหน้า /register จริง แต่กติกา ".invalid"/"Wrong"/"malicious"
 * เป็น convention ของข้อมูลทดสอบ (ใช้คุมคุณภาพ mock ไม่ใช่พฤติกรรมเว็บจริง)
 * พฤติกรรมปลายทางจริงยังคุมด้วย E2E (registration.spec.ts / authentication.spec.ts)
 */

describe('isPasswordPolicyCompliant — กติกา 4 ข้อจากหน้า /register จริง', () => {
  it('ผ่าน: ครบ 8 ตัวขึ้นไป + พิมพ์ใหญ่ + พิมพ์เล็ก + ตัวเลข', () => {
    expect(isPasswordPolicyCompliant('QaSecure!2026')).toBe(true);
    expect(isPasswordPolicyCompliant('Abcdefg1')).toBe(true); // พอดี 8 ตัว (BVA)
  });

  it('ไม่ผ่าน: สั้นกว่า 8 ตัว (ขอบล่าง BVA — 7 ตัวต้องตก)', () => {
    expect(isPasswordPolicyCompliant('Abcdef1')).toBe(false); // 7 ตัว
  });

  it('ไม่ผ่าน: ไม่มีตัวพิมพ์ใหญ่', () => {
    expect(isPasswordPolicyCompliant('abcdefg1')).toBe(false);
  });

  it('ไม่ผ่าน: ไม่มีตัวพิมพ์เล็ก', () => {
    expect(isPasswordPolicyCompliant('ABCDEFG1')).toBe(false);
  });

  it('ไม่ผ่าน: ไม่มีตัวเลข', () => {
    expect(isPasswordPolicyCompliant('Abcdefgh')).toBe(false);
  });

  it('ไม่ผ่าน: ค่าว่าง', () => {
    expect(isPasswordPolicyCompliant('')).toBe(false);
  });

  it('ผ่าน: รหัสยาว มีอักขระพิเศษผสม', () => {
    expect(isPasswordPolicyCompliant('Str0ng&P@ssw0rd-2026!')).toBe(true);
  });
});

describe('isDuplicateEmail — กติกาอีเมลซ้ำของ mock (409)', () => {
  it('มีคำว่า duplicate ที่ไหนก็ในอีเมล → ซ้ำ', () => {
    expect(isDuplicateEmail('duplicate@example.com')).toBe(true);
    expect(isDuplicateEmail('user+DUPLICATE-stamp@example.com')).toBe(true);
  });

  it('อีเมลปกติ → ไม่ซ้ำ', () => {
    expect(isDuplicateEmail('qa.tester+reg-123@example.com')).toBe(false);
    expect(isDuplicateEmail('')).toBe(false);
  });
});

describe('isLoginRejected — negative fixtures ของ mock login', () => {
  it('ค่าว่างทั้งคู่ → ปฏิเสธ', () => {
    expect(isLoginRejected('', '')).toBe(true);
  });

  it('อีเมลว่างแต่มีรหัสผ่าน → ปฏิเสธ (และกลับกัน)', () => {
    expect(isLoginRejected('', 'SomePass1')).toBe(true);
    expect(isLoginRejected('qa@example.com', '')).toBe(true);
  });

  it('อีเมล .invalid (negative fixture) → ปฏิเสธ', () => {
    expect(isLoginRejected('user.invalid@example.com', 'SomePass1')).toBe(true);
    expect(isLoginRejected('user@mail.invalid', 'SomePass1')).toBe(true);
  });

  it('รหัสผ่านขึ้นต้น "Wrong" (negative fixture) → ปฏิเสธ', () => {
    expect(isLoginRejected('qa@example.com', 'WrongPass1')).toBe(true);
  });

  it('ข้อมูลถูกต้อง → ไม่ปฏิเสธ', () => {
    expect(isLoginRejected('qa.tester@example.com', 'QaSecure!2026')).toBe(false);
  });

  it('รหัสผ่านที่มีแต่มีคำว่า Wrong กลางคำไม่ใช่การขึ้นต้น → ไม่ปฏิเสธ', () => {
    expect(isLoginRejected('qa@example.com', 'MyWrongPass1')).toBe(false);
  });
});

describe('isUploadRejected — กติกาอัปโหลด (blacklist + 5MB)', () => {
  it('เนื้อหามีชื่อไฟล์ blacklist (not-a-real-cv / malicious / oversized) → ปฏิเสธ', () => {
    expect(isUploadRejected('filename="not-a-real-cv.pdf"', 100)).toBe(true);
    expect(isUploadRejected('filename="malicious-sample.exe"', 100)).toBe(true);
    expect(isUploadRejected('filename="oversized-resume.pdf"', 100)).toBe(true);
    expect(isUploadRejected('NOT-A-REAL-CV.PDF', 100)).toBe(true); // case-insensitive
  });

  it('contentLength เกิน 5MB → ปฏิเสธ (ขอบบน BVA: 5,242,881 bytes)', () => {
    expect(isUploadRejected('clean-content', 5 * 1024 * 1024 + 1)).toBe(true);
  });

  it('contentLength พอดี 5MB → ไม่ปฏิเสธ (ขอบเขต BVA)', () => {
    expect(isUploadRejected('clean-content', 5 * 1024 * 1024)).toBe(false);
  });

  it('ไฟล์ปกติที่มีขนาดเล็ก → ไม่ปฏิเสธ', () => {
    expect(isUploadRejected('filename="sample-resume.pdf"', 2473)).toBe(false);
  });

  it('contentLength = 0 และเนื้อหาว่าง → ไม่ปฏิเสธ (ส่วนของ missing-field อยู่ที่ UI validation)', () => {
    expect(isUploadRejected('', 0)).toBe(false);
  });
});
