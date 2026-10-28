import { PASSWORD_POLICY } from '../config/config';

/**
 * ============================================================
 * Validators — กติกาธุรกิจแบบ pure function ของ Mock API layer
 * ============================================================
 * ที่มาของกติกา: แยกออกจาก fixtures/test-fixtures.ts (mock router) ที่เคย
 * เขียน inline ไว้ เพื่อให้ "unit test ได้จริง" โดยไม่ต้องเปิด browser
 *
 * ข้อจำกัดที่ต้องรายงานตรงไปตรงมา (ตามหลัก evidence-first):
 *  - กติกาเหล่านี้เป็น "กติกาของ mock layer" ที่จำลองพฤติกรรมที่สังเกตได้
 *    ของ learnace.tech (เช่น password policy 4 ข้อยืนยันจากหน้า /register จริง)
 *  - บางกติกาเป็น "convention ของข้อมูลทดสอบ" เท่านั้น (อีเมล ".invalid",
 *    รหัสผ่านขึ้นต้น "Wrong", ชื่อไฟล์ "malicious") — ใช้คุมคุณภาพของ mock
 *    ไม่ใช่พฤติกรรมที่ยืนยันแล้วว่าเว็บจริงทำแบบเดียวกัน
 */

/** รหัสผ่านผ่าน policy 4 ข้อ: >=8 ตัว, มี A-Z, มี a-z, มี 0-9 (ยืนยันจากหน้า /register จริง) */
export function isPasswordPolicyCompliant(password: string): boolean {
  return (
    password.length >= PASSWORD_POLICY.minLength &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

/** อีเมลที่ mock ถือว่า "ซ้ำในระบบ" (convention: มีคำว่า duplicate) */
export function isDuplicateEmail(email: string): boolean {
  return /duplicate/i.test(email);
}

/** Login ต้องถูกปฏิเสธหรือไม่ (ค่าว่าง / อีเมล .invalid / รหัสผ่านขึ้นต้น Wrong = negative fixtures) */
export function isLoginRejected(email: string, password: string): boolean {
  return !email || !password || email.includes('.invalid') || password.startsWith('Wrong');
}

/**
 * อัปโหลดต้องถูกปฏิเสธหรือไม่ — เกณฑ์: ชื่อ/เนื้อหาไฟล์อยู่ใน blacklist
 * (convention: not-a-real-cv / malicious / oversized) หรือขนาดเกิน 5MB
 */
export function isUploadRejected(rawContent: string, contentLength: number): boolean {
  return (
    /not-a-real-cv|malicious|oversized/i.test(rawContent) ||
    contentLength > 5 * 1024 * 1024
  );
}