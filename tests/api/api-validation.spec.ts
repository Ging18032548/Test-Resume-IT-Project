import { test, expect } from '@playwright/test';
import { ApiHelper } from '../../helpers/api-helper';
import { APP, API_PATHS } from '../../config/config';

/**
 * ============================================================
 * API Validation — ทดสอบ Backend API ด้วย HTTP จริง (ไม่ผ่าน page.route)
 * ============================================================
 * อ้างอิง Test Plan: TC-API-001 .. TC-API-007 (docs/test-plan.md)
 *
 * หลักการสำคัญ: ทุก assertion อิง "หลักฐานที่โพรบได้จริง" จากเว็บเป้าหมาย
 * (docs/website-inventory.md § API Probes) ได้แก่:
 *
 *   GET /api/jobs         → 401 {"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}
 *   GET /api/resumes      → 401 TOKEN_REQUIRED
 *   GET /api/analyses     → 404 {"message":"ไม่พบ API GET /api/analyses","code":"ENDPOINT_NOT_FOUND"}
 *   GET /api/analyses/:id → 401 TOKEN_REQUIRED
 *   GET /api/auth/me      → 401 TOKEN_REQUIRED
 *   GET /api/admin/stats  → 401 TOKEN_REQUIRED
 *   GET /api/admin/users  → 401 TOKEN_REQUIRED
 *
 * หมายเหตุความโปร่งใส:
 *  - โหมด Offline (BASE_URL=localhost) — mock-app-server สะท้อนพฤติกรรมเดียวกัน
 *    เพื่อยืนยันว่าเฟรมเวิร์กและ assertion ถูกต้อง (framework verification)
 *  - โหมด Live (BASE_URL=https://learnace.tech จากเครื่องผู้ใช้) — assertion ชุดเดิม
 *    จะไปยืนยันกับระบบจริงโดยตรง (live verification)
 *  - เส้น POST (login/register) ยัง "ยืนยันบนระบบจริงไม่ได้" จาก sandbox
 *    (WebFetch ทำได้เฉพาะ GET) — จึงกำกับสถานะ MOCK_ONLY/UNVERIFIED ใน config
 *    และ assertion ที่นี่จะเป็นการยืนยันครั้งแรกเมื่อรันบนเครื่องผู้ใช้
 */

test.describe('API Validation — HTTP Status & Envelope (ตามหลักฐานจริง)', () => {
  let api: ApiHelper;

  test.beforeEach(({ request }) => {
    api = new ApiHelper(request);
  });

  test('[TC-API-001] GET / — หน้าเว็บหลักตอบกลับได้ (200)', async ({ request }) => {
    const response = await request.get('/', { failOnStatusCode: false });
    expect(response.status(), 'หน้าแรกต้องตอบ 200').toBe(200);

    const body = await response.text();
    expect(body, 'หน้าแรกต้องมีเนื้อหา HTML ไม่ใช่คำตอบว่าง').not.toBe('');
  });

  test('[TC-API-002] GET /api/jobs — ไม่มีโทเคน → 401 TOKEN_REQUIRED', async () => {
    const response = await api.get(API_PATHS.jobs.path);
    await api.expectTokenRequired(response);
  });

  test('[TC-API-003] GET /api/resumes — ไม่มีโทเคน → 401 TOKEN_REQUIRED', async () => {
    const response = await api.get(API_PATHS.resumes.path);
    await api.expectTokenRequired(response);
  });

  test('[TC-API-004] GET /api/analyses — ยืนยันแล้วว่าเส้นนี้ "ไม่มีอยู่จริง" → 404 ENDPOINT_NOT_FOUND', async () => {
    // ผลโพรบจริง: {"success":false,"message":"ไม่พบ API GET /api/analyses","code":"ENDPOINT_NOT_FOUND"}
    // เทสต์นี้ "ล็อกพฤติกรรมจริง" ไว้ — หาก backend เปิดเส้นนี้ในอนาคต เทสต์จะแจ้งเตือน
    const response = await api.get(API_PATHS.analysesCollection.path);
    await api.expectEndpointNotFound(response, '/api/analyses');
  });

  test('[TC-API-005] GET /api/admin/stats และ /api/admin/users — ป้องกันด้วย TOKEN_REQUIRED', async () => {
    const stats = await api.get(API_PATHS.adminStats.path);
    await api.expectTokenRequired(stats);

    const users = await api.get(API_PATHS.adminUsers.path);
    await api.expectTokenRequired(users);
  });

  test('[TC-API-006] GET /api/auth/me — ไม่มีโทเคน → 401 TOKEN_REQUIRED', async () => {
    const response = await api.get(API_PATHS.me.path);
    await api.expectTokenRequired(response);
  });

  test('[TC-API-007] POST /api/auth/login — payload ว่าง → ถูกปฏิเสธ (4xx) พร้อม envelope', async () => {
    const response = await api.post(API_PATHS.login.path, {});
    const status = response.status();

    expect(
      status,
      'login ด้วย payload ว่างต้องถูกปฏิเสธในช่วง 4xx'
    ).toBeGreaterThanOrEqual(400);
    expect(status, 'ไม่ควรเป็น server error (5xx)').toBeLessThan(500);

    const body = await api.readEnvelope(response);
    expect(body.success, 'envelope.success ต้องเป็น false').toBe(false);
    expect(body.message, 'ต้องมีข้อความอธิบายเหตุผล').toBeTruthy();
  });

  test('[TC-API-008] POST /api/auth/login — credentials ถูกต้อง (โหมด mock/QA) → ได้ token', async () => {
    // ข้อควรระวัง: ในโหมด live การยิง credentials จริงต้องใช้บัญชี QA ที่ได้รับอนุญาตเท่านั้น
    // ค่า default เหล่านี้ใช้ได้เฉพาะกับ mock-app-server / QA backend
    test.skip(
      !APP.mockApi && !process.env.TEST_EMAIL,
      'BLOCKED: โหมด live ต้องมีบัญชีทดสอบจริง (TEST_EMAIL/TEST_PASSWORD) ที่ได้รับอนุญาตก่อนจึงจะทดสอบ login สำเร็จได้'
    );

    const response = await api.post(API_PATHS.login.path, {
      email: process.env.TEST_EMAIL || 'qa.tester@example.com',
      password: process.env.TEST_PASSWORD || 'QaSecure!2026',
    });

    expect(response.status(), 'login สำเร็จต้องคืน 200 หรือ 201').toBeLessThan(300);
    const body = await api.readEnvelope(response);
    expect(body.success).toBe(true);

    const data = body.data as { token?: string; user?: { email?: string } } | null;
    expect(data?.token, 'ต้องได้ token กลับมาสำหรับเรียก API อื่นต่อ').toBeTruthy();
    expect(data?.user?.email, 'ต้องคืนข้อมูลผู้ใช้พร้อมอีเมล').toBeTruthy();
  });

  test('[TC-API-009] GET /api/analyses/1 — เส้นรายการเดียวมีอยู่จริงและถูกป้องกันด้วยโทเคน', async () => {
    // หลักฐาน: ต่างจาก collection — /api/analyses/:id ตอบ TOKEN_REQUIRED (มี route จริง)
    const response = await api.get(API_PATHS.analysisItem.path);
    await api.expectTokenRequired(response);
  });
});
