import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ============================================================
 * Unit Tests — config/config.ts (ค่ากลางของเฟรมเวิร์ก)
 * ============================================================
 * ครอบคลุม:
 *  - APP.isMockAppServer: ตัวตัดสิน "โหมด" ที่ assertion แบบ mode-aware พึ่งพา
 *    (ผิดที่นี่ = assertion ผิดทั้งระบบ จึงต้อง pin ไว้)
 *  - ROUTES / API_ENVELOPE_CODES: route และ envelope ที่ยืนยันจากการโพรบเว็บจริง
 *    ถ้าค่าเปลี่ยน = หลักฐานเปลี่ยน → ต้องมีการโพรบใหม่ก่อนแก้
 *  - TIMEOUTS: ค่าที่ปรับจากเหตุการณ์จริง (tunnel โหลดช้า)
 *  - PASSWORD_POLICY: กติกา 4 ข้อจากหน้า /register จริง
 */

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('APP.isMockAppServer — การตรวจจับโหมดแอปจำลอง', () => {
  const loadWithBaseUrl = async (baseUrl: string | undefined) => {
    if (baseUrl === undefined) {
      vi.stubEnv('BASE_URL', '');
      delete process.env.BASE_URL;
    } else {
      vi.stubEnv('BASE_URL', baseUrl);
    }
    const mod = await import('../../config/config');
    return mod.APP.isMockAppServer;
  };

  it('BASE_URL = localhost → โหมดแอปจำลอง (true)', async () => {
    expect(await loadWithBaseUrl('http://localhost:4310')).toBe(true);
  });

  it('BASE_URL = 127.0.0.1 → โหมดแอปจำลอง (true)', async () => {
    expect(await loadWithBaseUrl('http://127.0.0.1:4310')).toBe(true);
  });

  it('BASE_URL = เว็บจริง learnace.tech → ไม่ใช่โหมดแอปจำลอง (false)', async () => {
    expect(await loadWithBaseUrl('https://learnace.tech')).toBe(false);
  });

  it('BASE_URL ไม่ได้ตั้ง → default คือเว็บจริง (false)', async () => {
    expect(await loadWithBaseUrl(undefined)).toBe(false);
  });
});

describe('APP.mockApi — สวิตช์ persistence mock', () => {
  const loadMockApi = async (value: string | undefined) => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    if (value === undefined) {
      delete process.env.MOCK_API;
    } else {
      vi.stubEnv('MOCK_API', value);
    }
    const mod = await import('../../config/config');
    return mod.APP.mockApi;
  };

  it('MOCK_API ไม่ได้ตั้ง → mock เปิด (default)', async () => {
    expect(await loadMockApi(undefined)).toBe(true);
  });

  it('MOCK_API=true → mock เปิด', async () => {
    expect(await loadMockApi('true')).toBe(true);
  });

  it('MOCK_API=false → mock ปิด (ใช้กับ QA backend จริง)', async () => {
    expect(await loadMockApi('false')).toBe(false);
  });
});

describe('ROUTES — เส้นทางที่ยืนยันจากการโพรบเว็บจริง (regression pins)', () => {
  it('ตรงกับหลักฐานใน docs/website-inventory.md', async () => {
    const { ROUTES } = await import('../../config/config');
    expect(ROUTES.home).toBe('/');
    expect(ROUTES.signIn).toBe('/sign-in');
    expect(ROUTES.register).toBe('/register');
    expect(ROUTES.dashboard).toBe('/dashboard');
    expect(ROUTES.jobs).toBe('/jobs');
    expect(ROUTES.uploadResume).toBe('/resumes/upload');
    expect(ROUTES.admin).toBe('/admin');
  });
});

describe('API_ENVELOPE_CODES — รูปแบบ envelope จริงของระบบ (จาก probe)', () => {
  it('ตรงกับหลักฐาน GET /api/** ที่โพรบได้', async () => {
    const { API_ENVELOPE_CODES } = await import('../../config/config');
    expect(API_ENVELOPE_CODES.tokenRequired).toBe('TOKEN_REQUIRED');
    expect(API_ENVELOPE_CODES.endpointNotFound).toBe('ENDPOINT_NOT_FOUND');
    expect(API_ENVELOPE_CODES.unauthorizedMessage).toBe('กรุณาเข้าสู่ระบบ');
    expect(API_ENVELOPE_CODES.notFoundMessagePrefix).toBe('ไม่พบ API');
  });
});

describe('TIMEOUTS — ค่าที่ปรับจากเหตุการณ์จริงบนเว็บจริง', () => {
  it('navigation ต้องเป็น 60s (TC-AUTH-004 จริง: tunnel โหลดเกิน 30s)', async () => {
    delete process.env.TEST_TIMEOUT;
    delete process.env.EXPECT_TIMEOUT;
    const { TIMEOUTS } = await import('../../config/config');
    expect(TIMEOUTS.navigation).toBe(60_000);
    expect(TIMEOUTS.expect).toBe(15_000);
    expect(TIMEOUTS.action).toBe(15_000);
  });

  it('รองรับ override ผ่าน TEST_TIMEOUT / EXPECT_TIMEOUT', async () => {
    vi.stubEnv('TEST_TIMEOUT', '5000');
    vi.stubEnv('EXPECT_TIMEOUT', '3000');
    const { TIMEOUTS } = await import('../../config/config');
    expect(TIMEOUTS.test).toBe(5000);
    expect(TIMEOUTS.expect).toBe(3000);
  });
});

describe('PASSWORD_POLICY — กติกาจากหน้า /register จริง (real-time checklist 4 ข้อ)', () => {
  it('ตรงกับข้อความบนฟอร์มจริง', async () => {
    const { PASSWORD_POLICY } = await import('../../config/config');
    expect(PASSWORD_POLICY.minLength).toBe(8);
    expect(PASSWORD_POLICY.requireUppercase).toBe(true);
    expect(PASSWORD_POLICY.requireLowercase).toBe(true);
    expect(PASSWORD_POLICY.requireDigit).toBe(true);
    expect(PASSWORD_POLICY.ruleLabels).toEqual([
      'อย่างน้อย 8 ตัวอักษร',
      'ตัวพิมพ์ใหญ่ (A–Z)',
      'ตัวพิมพ์เล็ก (a–z)',
      'ตัวเลข (0–9)',
    ]);
  });
});
