import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isPasswordPolicyCompliant } from '../../helpers/validators';
// import type = ถูกลบตอนคอมไพล์ ไม่มีผลกับ vi.resetModules() — ใช้ pin type ของ callback เท่านั้น
import type { TeamUser } from '../../fixtures/test-data';

/**
 * ============================================================
 * Unit Tests — fixtures/test-data.ts (ข้อมูลประจำตัวทดสอบ)
 * ============================================================
 * ครอบคลุมฟังก์ชันที่ตัดสิน "รันหรือ BLOCKED" ของทั้งชุดเทสต์:
 *  - hasTestAccount(): ผิดที่นี่ = เทสต์ REAL จะรันทั้งที่ไม่มีบัญชี หรือ
 *    BLOCKED ทั้งที่มีบัญชี — จึงต้อง pin ทุกกรณี
 *  - canRunRealRegistration(): วาล์วกันสมัครสมาชิกบนระบบจริงโดยไม่ตั้งใจ
 *  - MOCK_CREDENTIALS: ใช้ได้เฉพาะ MOCK mode (ห้ามเผลอใช้กับระบบจริง)
 */

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('hasTestAccount — วาล์วตัดสินว่ามีบัญชีทดสอบจริงหรือไม่', () => {
  const load = async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    return import('../../fixtures/test-data');
  };

  it('มี TEST_EMAIL + TEST_PASSWORD → true', async () => {
    vi.stubEnv('TEST_EMAIL', 'qa@example.com');
    vi.stubEnv('TEST_PASSWORD', 'Secret!123');
    const mod = await load();
    expect(mod.hasTestAccount()).toBe(true);
  });

  it('มีแค่ TEST_EMAIL → false (BLOCKED ตามถูกต้อง)', async () => {
    vi.stubEnv('TEST_EMAIL', 'qa@example.com');
    delete process.env.TEST_PASSWORD;
    const mod = await load();
    expect(mod.hasTestAccount()).toBe(false);
  });

  it('มีแค่ TEST_PASSWORD → false (BLOCKED ตามถูกต้อง)', async () => {
    delete process.env.TEST_EMAIL;
    vi.stubEnv('TEST_PASSWORD', 'Secret!123');
    const mod = await load();
    expect(mod.hasTestAccount()).toBe(false);
  });

  it('ไม่ตั้งอะไรเลย → false (สถานะปัจจุบันของโปรเจกต์: ยังไม่มีบัญชี QA)', async () => {
    delete process.env.TEST_EMAIL;
    delete process.env.TEST_PASSWORD;
    const mod = await load();
    expect(mod.hasTestAccount()).toBe(false);
  });
});

describe('canRunRealRegistration — วาล์วกันสมัครจริงโดยไม่ตั้งใจ', () => {
  const load = async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    return import('../../fixtures/test-data');
  };

  it('ครบทั้ง 3 เงื่อนไข (ALLOW_REGISTRATION_TEST=true + อีเมล + รหัสผ่าน) → true', async () => {
    vi.stubEnv('ALLOW_REGISTRATION_TEST', 'true');
    vi.stubEnv('REGISTRATION_EMAIL', 'new.user@example.com');
    vi.stubEnv('REGISTRATION_PASSWORD', 'NewUser!2026');
    const mod = await load();
    expect(mod.canRunRealRegistration()).toBe(true);
  });

  it('ไม่เปิด ALLOW_REGISTRATION_TEST → false แม้มีบัญชี (ป้องกันพลาด)', async () => {
    delete process.env.ALLOW_REGISTRATION_TEST;
    vi.stubEnv('REGISTRATION_EMAIL', 'new.user@example.com');
    vi.stubEnv('REGISTRATION_PASSWORD', 'NewUser!2026');
    const mod = await load();
    expect(mod.canRunRealRegistration()).toBe(false);
  });

  it('ALLOW_REGISTRATION_TEST เป็นค่าอื่นที่ไม่ใช่ "true" → false', async () => {
    vi.stubEnv('ALLOW_REGISTRATION_TEST', 'yes');
    vi.stubEnv('REGISTRATION_EMAIL', 'new.user@example.com');
    vi.stubEnv('REGISTRATION_PASSWORD', 'NewUser!2026');
    const mod = await load();
    expect(mod.canRunRealRegistration()).toBe(false);
  });

  it('เปิด flag แต่ไม่มีข้อมูลบัญชี → false', async () => {
    vi.stubEnv('ALLOW_REGISTRATION_TEST', 'true');
    delete process.env.REGISTRATION_EMAIL;
    delete process.env.REGISTRATION_PASSWORD;
    const mod = await load();
    expect(mod.canRunRealRegistration()).toBe(false);
  });
});

describe('MOCK_CREDENTIALS — บัญชีเฉพาะ MOCK mode', () => {
  it('ต้องเป็นโดเมน example.test-family ที่ไม่ใช่โดเมนจริง (กันเผลอยิงระบบจริง)', async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    const mod = await import('../../fixtures/test-data');
    expect(mod.MOCK_CREDENTIALS.email).toMatch(/@example\.com$/);
    expect(mod.MOCK_CREDENTIALS.email).not.toContain('learnace');
    expect(mod.MOCK_CREDENTIALS.password.length).toBeGreaterThanOrEqual(8);
  });
});

describe('TEAM_USERS — บัญชีทีมงาน 3 คน (ข้อมูลที่ผู้ใช้ระบุ 2026-10-27)', () => {
  it('ต้องมีครบ 3 คน: Kanyarat / Phiraphat / Varin ตามที่ผู้ใช้กำหนด', async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    const mod = await import('../../fixtures/test-data');
    expect(mod.TEAM_USERS).toHaveLength(3);
    expect(mod.TEAM_USERS.map((m: TeamUser) => m.displayName)).toEqual([
      'Kanyarat Patthanan',
      'Phiraphat Chayanon',
      'Varin Methawee',
    ]);
  });

  it('อีเมลไม่ซ้ำกันและอยู่ในรูปแบบที่ฟอร์ม register ยอมรับ', async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    const mod = await import('../../fixtures/test-data');
    const emails = mod.TEAM_USERS.map((m: TeamUser) => m.email);
    expect(new Set(emails).size).toBe(emails.length);
    for (const email of emails) {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }
  });

  it('รหัสผ่านทุกบัญชีต้องผ่าน password policy 4 ข้อ (ต่อให้ login/register mock ยอมรับ)', async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    const mod = await import('../../fixtures/test-data');
    for (const member of mod.TEAM_USERS) {
      expect(
        isPasswordPolicyCompliant(member.password),
        `รหัสผ่านของ ${member.displayName} ต้องผ่าน policy`
      ).toBe(true);
    }
  });

  it('findTeamUserByEmail ต้องหาเจอแบบ case-insensitive และไม่เจอกรณีอีเมลแปลกด้วย', async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    const mod = await import('../../fixtures/test-data');
    expect(mod.findTeamUserByEmail('KANYARAT.P.HR@GMAIL.COM')?.displayName).toBe('Kanyarat Patthanan');
    expect(mod.findTeamUserByEmail('varin.m.uxui@gmail.com')?.lastName).toBe('METHAWEE');
    expect(mod.findTeamUserByEmail('nobody@example.test')).toBeUndefined();
  });
});

describe('hasTeamCredentials — วาล์วรันชุด TEAM-REAL (โหมดจริง)', () => {
  const load = async () => {
    vi.stubEnv('BASE_URL', 'https://learnace.tech');
    return import('../../fixtures/test-data');
  };

  it('ตั้ง TEAM_*_PASSWORD ครบ 3 คน → true', async () => {
    vi.stubEnv('TEAM_KANYARAT_PASSWORD', 'KanyaratHr#99$');
    vi.stubEnv('TEAM_PHIRAPHAT_PASSWORD', 'PhiraphatFin*88_');
    vi.stubEnv('TEAM_VARIN_PASSWORD', 'VarinDesign#55+');
    const mod = await load();
    expect(mod.hasTeamCredentials()).toBe(true);
  });

  it('ขาดคนใดคนหนึ่ง → false (BLOCKED ตามกฎ: ไม่ครบ = ไม่ยิง production)', async () => {
    vi.stubEnv('TEAM_KANYARAT_PASSWORD', 'KanyaratHr#99$');
    vi.stubEnv('TEAM_VARIN_PASSWORD', 'VarinDesign#55+');
    delete process.env.TEAM_PHIRAPHAT_PASSWORD;
    const mod = await load();
    expect(mod.hasTeamCredentials()).toBe(false);
  });

  it('ไม่ตั้งอะไรเลย → false (สถานะ default ก่อนแก้ .env)', async () => {
    delete process.env.TEAM_KANYARAT_PASSWORD;
    delete process.env.TEAM_PHIRAPHAT_PASSWORD;
    delete process.env.TEAM_VARIN_PASSWORD;
    const mod = await load();
    expect(mod.hasTeamCredentials()).toBe(false);
  });
});