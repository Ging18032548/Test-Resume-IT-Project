import { test, expect } from '../../fixtures/test-fixtures';
import { APP } from '../../config/config';

/**
 * ============================================================
 * PROBE — หลักฐานประกอบคำถาม:
 * "test sign in/register แล้วข้อมูล user ไม่แสดงใน /admin"
 * ============================================================
 * ขั้นตอน (ทำในเทสต์เดียว, ผ่าน mock API ที่ติดตั้งอัตโนมัติ):
 *   1. POST /api/auth/register ด้วยอีเมลใหม่ (จากหน้าเว็บจริง ผ่าน fetch ใน page)
 *   2. ใช้ token ที่ได้ GET /api/admin/users
 *   3. ตรวจว่า user ที่เพิ่งสมัครปรากฏในรายชื่อหรือไม่
 *
 * ก่อนแก้ fixtures: คาดว่า FAIL (user ใหม่หาย — ซ้ำอาการที่ผู้ใช้รายงาน)
 * หลังแก้ fixtures: ต้อง PASS
 */
test.skip(
  !APP.mockApi,
  'PROBE ใช้ได้เฉพาะโหมด mock (MOCK_API=true) — เมื่อ MOCK_API=false การ register นี้จะสร้างบัญชีจริงบนเว็บ production ซึ่งห้ามทำโดยไม่ได้รับอนุญาต'
);

test('[PROBE-ADM] user ที่สมัครผ่าน register ต้องปรากฏในรายชื่อ /api/admin/users', async ({ page }) => {
  const unique = `probe.${Date.now()}@probe.test`;

  // เข้าหน้าแรกก่อน เพื่อให้ fetch ยิงจาก origin ของแอปจริง (route mock ครอบ **/api/**)
  await page.goto('/');

  const result = await page.evaluate(async (email) => {
    const registerRes = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Probe Tester',
        email,
        password: 'Str0ngPass',
        confirmPassword: 'Str0ngPass',
      }),
    });
    const registerJson = await registerRes.json();

    const token = (registerJson as { data?: { token?: string } })?.data?.token ?? '';
    const usersRes = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const usersJson = (await usersRes.json()) as { data?: { users?: Array<{ email: string }> } };

    return {
      registerStatus: registerRes.status,
      registerMessage: registerJson?.message,
      usersStatus: usersRes.status,
      users: usersJson?.data?.users ?? [],
    };
  }, unique);

  // หลักฐานชั้นที่ 1: register ต้องสำเร็จก่อน (201)
  expect(result.registerStatus, 'register ต้องสำเร็จ').toBe(201);

  // หลักฐานชั้นที่ 2: user ที่เพิ่งสมัครต้องอยู่ในลิสต์ที่ /admin จะเห็น
  const found = result.users.some((u) => u.email === unique);
  expect(
    found,
    `user ใหม่ (${unique}) ต้องปรากฏใน /api/admin/users — ปัจจุบันมี ${result.users.length} คน: ` +
      result.users.map((u) => u.email).join(', ')
  ).toBe(true);
});