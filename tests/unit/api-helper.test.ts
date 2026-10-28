import { describe, it, expect, vi } from 'vitest';
import type { APIResponse } from '@playwright/test';
import { ApiHelper } from '../../helpers/api-helper';

/**
 * ============================================================
 * Unit Tests — helpers/api-helper.ts (ตัวช่วยยิง API + assertion มาตรฐาน)
 * ============================================================
 * ครอบคลุม:
 *  - readEnvelope(): parse JSON / โยน error พร้อม status + body ตัดสั้นเมื่อไม่ใช่ JSON
 *  - expectTokenRequired(): ยืนยัน envelope 401 ตามหลักฐานจริง (TOKEN_REQUIRED)
 *  - expectEndpointNotFound(): ยืนยัน envelope 404 ตามหลักฐานจริง (GET /api/analyses)
 *  - get()/post(): แนบ Authorization header ถูกต้องเมื่อมี/ไม่มี token
 *
 * การทดสอบทั้งหมด "ไม่ยิงเว็บจริง" — fake APIResponse/APIRequestContext ทั้งหมด
 */

/** ปลอม APIResponse จาก object ธรรมดา (unit test ไม่ต้องมี network) */
function fakeResponse(status: number, bodyText: string): APIResponse {
  return {
    status: () => status,
    text: async () => bodyText,
  } as unknown as APIResponse;
}

/** ปลอม APIRequestContext ที่จับ headers ที่ยิงออกไป */
function fakeRequestContext() {
  const captured: Array<{ url: string; headers: Record<string, string> }> = [];
  const context = {
    get: async (url: string, options?: { headers?: Record<string, string> }) => {
      captured.push({ url, headers: options?.headers ?? {} });
      return fakeResponse(200, '{}');
    },
    post: async (url: string, options?: { headers?: Record<string, string> }) => {
      captured.push({ url, headers: options?.headers ?? {} });
      return fakeResponse(200, '{}');
    },
  };
  return { context: context as never, captured };
}

describe('readEnvelope — อ่าน body เป็น JSON envelope', () => {
  const helper = new ApiHelper({} as never);

  it('parse JSON ปกติได้ครบทั้ง success/message/code', async () => {
    const env = await helper.readEnvelope(
      fakeResponse(401, '{"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}')
    );
    expect(env).toEqual({
      success: false,
      message: 'กรุณาเข้าสู่ระบบ',
      code: 'TOKEN_REQUIRED',
    });
  });

  it('body ไม่ใช่ JSON → โยน error พร้อม status code ในข้อความ', async () => {
    await expect(
      helper.readEnvelope(fakeResponse(502, '<html>Bad Gateway</html>'))
    ).rejects.toThrow('ไม่ใช่ JSON (status 502)');
  });

  it('error message ตัด body ยาว ๆ ไม่เกิน 200 ตัวอักษร (กัน log บวม)', async () => {
    const longBody = 'x'.repeat(500);
    const error = await helper
      .readEnvelope(fakeResponse(500, longBody))
      .catch((e: Error) => e.message);
    expect(error).toContain('x'.repeat(200));
    expect((error as string).length).toBeLessThan(300);
  });
});

describe('expectTokenRequired — envelope 401 ตามหลักฐานจริงของ learnace.tech', () => {
  const helper = new ApiHelper({} as never);

  it('status 401 + envelope TOKEN_REQUIRED ภาษาไทยถูกต้อง → ผ่าน', async () => {
    const body = await helper.expectTokenRequired(
      fakeResponse(401, '{"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}')
    );
    expect(body.code).toBe('TOKEN_REQUIRED');
  });

  it('status ไม่ใช่ 401 → fail ทันที (กันระบบเปลี่ยนพฤติกรรมเงียบ ๆ)', async () => {
    await expect(
      helper.expectTokenRequired(
        fakeResponse(200, '{"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"TOKEN_REQUIRED"}')
      )
    ).rejects.toThrow();
  });

  it('code ไม่ใช่ TOKEN_REQUIRED → fail', async () => {
    await expect(
      helper.expectTokenRequired(
        fakeResponse(401, '{"success":false,"message":"กรุณาเข้าสู่ระบบ","code":"SOMETHING_ELSE"}')
      )
    ).rejects.toThrow();
  });

  it('message ไม่มีคำ "เข้าสู่ระบบ" → fail (pin ข้อความจริงของระบบ)', async () => {
    await expect(
      helper.expectTokenRequired(
        fakeResponse(401, '{"success":false,"message":"unauthorized","code":"TOKEN_REQUIRED"}')
      )
    ).rejects.toThrow();
  });
});

describe('expectEndpointNotFound — envelope 404 ตามหลักฐาน GET /api/analyses จริง', () => {
  const helper = new ApiHelper({} as never);

  it('status 404 + ENDPOINT_NOT_FOUND + อ้าง path ใน message → ผ่าน', async () => {
    const body = await helper.expectEndpointNotFound(
      fakeResponse(404, '{"success":false,"message":"ไม่พบ API GET /api/analyses","code":"ENDPOINT_NOT_FOUND"}'),
      '/api/analyses'
    );
    expect(body.code).toBe('ENDPOINT_NOT_FOUND');
  });

  it('status ไม่ใช่ 404 → fail', async () => {
    await expect(
      helper.expectEndpointNotFound(
        fakeResponse(200, '{"success":false,"message":"ไม่พบ API GET /api/analyses","code":"ENDPOINT_NOT_FOUND"}'),
        '/api/analyses'
      )
    ).rejects.toThrow();
  });

  it('message ไม่อ้างถึง path ที่คาดไว้ → fail', async () => {
    await expect(
      helper.expectEndpointNotFound(
        fakeResponse(404, '{"success":false,"message":"ไม่พบ API GET /api/other","code":"ENDPOINT_NOT_FOUND"}'),
        '/api/analyses'
      )
    ).rejects.toThrow();
  });
});

describe('get/post — การแนบ Authorization header', () => {
  it('get ไม่มี token → ไม่แนบ Authorization', async () => {
    const { context, captured } = fakeRequestContext();
    const helper = new ApiHelper(context);
    await helper.get('/api/resumes');
    expect(captured[0].headers['Authorization']).toBeUndefined();
  });

  it('get มี token → แนบ Bearer ถูกต้อง', async () => {
    const { context, captured } = fakeRequestContext();
    const helper = new ApiHelper(context);
    await helper.get('/api/resumes', 'abc123');
    expect(captured[0].headers['Authorization']).toBe('Bearer abc123');
  });

  it('post มี token → แนบ Bearer ถูกต้อง', async () => {
    const { context, captured } = fakeRequestContext();
    const helper = new ApiHelper(context);
    await helper.post('/api/auth/login', { email: 'a@b.com' }, 'tok-xyz');
    expect(captured[0].headers['Authorization']).toBe('Bearer tok-xyz');
  });

  it('failOnStatusCode ต้องเป็น false เสมอ (4xx/5xx เป็น "ผลทดสอบ" ไม่ใช่ crash)', async () => {
    let seenOptions: Record<string, unknown> | undefined;
    const context = {
      get: async (_url: string, options?: Record<string, unknown>) => {
        seenOptions = options;
        return fakeResponse(401, '{}');
      },
    } as never;
    const helper = new ApiHelper(context);
    await helper.get('/api/jobs');
    expect(seenOptions?.['failOnStatusCode']).toBe(false);
  });
});
